import re
import secrets
from datetime import timedelta

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from ..extensions import db, limiter
from ..models import User, utcnow

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,30}$")

# Generic response used for both the "email sent" and "email doesn't exist"
# cases on /forgot-password, so an attacker can't use it to enumerate which
# emails have accounts.
FORGOT_PASSWORD_GENERIC_MESSAGE = (
    "If an account exists for that email, a password reset link has been sent."
)


@auth_bp.post("/register")
@limiter.limit("5 per minute")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not email or not EMAIL_RE.match(email):
        return jsonify({"error": "A valid email is required"}), 400
    if not username or not USERNAME_RE.match(username):
        return jsonify({
            "error": "Username must be 3-30 characters: letters, numbers, or underscores only"
        }), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with that email already exists"}), 409
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "That username is already taken"}), 409

    user = User(email=email, username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 201


@auth_bp.post("/login")
@limiter.limit("5 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict()), 200


@auth_bp.post("/forgot-password")
@limiter.limit("3 per minute")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email or not EMAIL_RE.match(email):
        return jsonify({"error": "A valid email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if user:
        token = secrets.token_urlsafe(32)
        expires_minutes = current_app.config.get("PASSWORD_RESET_TOKEN_EXPIRES_MINUTES", 30)
        user.set_reset_token(token, utcnow() + timedelta(minutes=expires_minutes))
        db.session.commit()

        # NOTE: this project has no email/SMTP provider configured yet.
        # In production, send `token` to the user's email instead of
        # logging it — never return it in the API response, since that
        # would let anyone reset any account's password.
        reset_link = f"{current_app.config.get('FRONTEND_URL', '')}/reset-password?token={token}&email={email}"
        current_app.logger.info("Password reset link for %s: %s", email, reset_link)

    # Always return the same response whether or not the account exists.
    return jsonify({"message": FORGOT_PASSWORD_GENERIC_MESSAGE}), 200


@auth_bp.post("/reset-password")
@limiter.limit("5 per minute")
def reset_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    token = data.get("token") or ""
    new_password = data.get("password") or ""

    if not email or not token:
        return jsonify({"error": "A reset token and email are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_reset_token(token):
        return jsonify({"error": "That reset link is invalid or has expired"}), 400

    user.set_password(new_password)
    user.clear_reset_token()
    db.session.commit()

    return jsonify({"message": "Password updated. You can now log in."}), 200
