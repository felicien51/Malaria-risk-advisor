import re
import secrets
from datetime import timedelta

import requests
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from ..extensions import db, limiter
from ..models import User, utcnow

auth_bp = Blueprint("auth", __name__)


def _issue_tokens(user):
    """Access + refresh token pair for a freshly authenticated user. Both
    embed token_version so the existing revocation check (see
    app/__init__.py's token_in_blocklist_loader) covers refresh tokens the
    same way it already covers access tokens — a password reset or
    logout-everywhere invalidates both, not just the short-lived one."""
    claims = {"token_version": user.token_version}
    return {
        "token": create_access_token(identity=str(user.id), additional_claims=claims),
        "refresh_token": create_refresh_token(identity=str(user.id), additional_claims=claims),
    }

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,30}$")

# Not exhaustive — just enough to block the handful of passwords that show
# up at the top of every leaked-password frequency list, so length alone
# doesn't wave through "password123"-style choices.
COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789",
    "1234567890", "qwerty123", "letmein1", "welcome1", "iloveyou1",
    "admin1234", "abc123456", "football1", "monkey123", "dragon123",
}


def is_weak_password(password):
    return password.lower() in COMMON_PASSWORDS

# Generic response used for both the "email sent" and "email doesn't exist"
# cases on /forgot-password, so an attacker can't use it to enumerate which
# emails have accounts.
FORGOT_PASSWORD_GENERIC_MESSAGE = (
    "If an account exists for that email, a password reset link has been sent."
)


def send_password_reset_email(email, reset_link):
    """Sends the reset link via Brevo's transactional email HTTP API if
    BREVO_API_KEY is configured; otherwise logs it to the console so local
    dev keeps working without a Brevo account. Uses plain HTTPS rather than
    SMTP because Render's free tier blocks outbound SMTP ports. Any send
    failure is logged and swallowed — forgot-password must still return its
    generic success response either way, so it can't be used to probe
    whether email delivery is broken for a particular address."""
    api_key = current_app.config.get("BREVO_API_KEY")
    if not api_key:
        current_app.logger.info("Password reset link for %s: %s", email, reset_link)
        return

    expires_minutes = current_app.config.get("PASSWORD_RESET_TOKEN_EXPIRES_MINUTES", 30)
    payload = {
        "sender": {
            "name": current_app.config.get("BREVO_SENDER_NAME", "Malaria Risk Advisor"),
            "email": current_app.config.get("BREVO_SENDER_EMAIL"),
        },
        "to": [{"email": email}],
        "subject": "Reset your Malaria Risk Advisor password",
        "textContent": (
            "We received a request to reset your Malaria Risk Advisor password.\n\n"
            f"Reset it here: {reset_link}\n\n"
            f"This link expires in {expires_minutes} minutes. "
            "If you didn't request this, you can safely ignore this email."
        ),
    }

    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            json=payload,
            headers={"api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"},
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException:
        # Don't leak email-provider failures to the client — log it and let
        # the generic "if an account exists..." response go out regardless.
        current_app.logger.exception("Failed to send password reset email to %s", email)


@auth_bp.post("/register")
@limiter.limit("5 per minute")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not EMAIL_RE.match(email):
        return jsonify({"error": "A valid email is required"}), 400
    if not username or not USERNAME_RE.match(username):
        return jsonify({
            "error": "Username must be 3-30 characters: letters, numbers, or underscores only"
        }), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if is_weak_password(password):
        return jsonify({"error": "That password is too common. Please choose a stronger one"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with that email already exists"}), 409
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "That username is already taken"}), 409

    user = User(email=email, username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({**_issue_tokens(user), "user": user.to_dict()}), 201


@auth_bp.post("/login")
@limiter.limit("5 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({**_issue_tokens(user), "user": user.to_dict()}), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict()), 200


@auth_bp.patch("/me")
@jwt_required()
@limiter.limit("10 per minute")
def update_me():
    """Lets an account set/change its username — mainly for legacy accounts
    created before the username field existed, which otherwise have no way
    to get one without a raw DB edit."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    if "username" not in data:
        return jsonify({"error": "Nothing to update"}), 400

    username = (data.get("username") or "").strip().lower()
    if not username or not USERNAME_RE.match(username):
        return jsonify({
            "error": "Username must be 3-30 characters: letters, numbers, or underscores only"
        }), 400

    existing = User.query.filter(User.username == username, User.id != user.id).first()
    if existing:
        return jsonify({"error": "That username is already taken"}), 409

    user.username = username
    db.session.commit()
    return jsonify(user.to_dict()), 200


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
@limiter.limit("30 per minute")
def refresh():
    """Exchanges a valid refresh token for a new access token. Only a
    token created via create_refresh_token (type: "refresh") satisfies
    @jwt_required(refresh=True) — an access token gets rejected here even
    if it's otherwise valid, so the two can't be used interchangeably.
    Looking token_version up fresh from the DB (rather than trusting the
    refresh token's own claim) means a just-changed password is reflected
    immediately in the new access token, even though the refresh token
    itself was already re-validated against the current token_version by
    the blocklist check before this handler ever runs."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    token = create_access_token(
        identity=str(user.id), additional_claims={"token_version": user.token_version}
    )
    return jsonify({"token": token}), 200


@auth_bp.post("/logout-everywhere")
@jwt_required()
def logout_everywhere():
    """Invalidates every access token issued to this account so far —
    including the one used to call this endpoint. Useful if a device is
    lost or a session looks compromised but the password itself is fine."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.revoke_all_tokens()
    db.session.commit()
    return jsonify({"message": "Logged out on all devices."}), 200


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

        # Emails via Gmail SMTP when MAIL_USERNAME/MAIL_PASSWORD are set;
        # otherwise logs the link to the console (see
        # send_password_reset_email above).
        reset_link = f"{current_app.config.get('FRONTEND_URL', '')}/reset-password?token={token}&email={email}"
        send_password_reset_email(email, reset_link)

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
    if is_weak_password(new_password):
        return jsonify({"error": "That password is too common. Please choose a stronger one"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_reset_token(token):
        return jsonify({"error": "That reset link is invalid or has expired"}), 400

    user.set_password(new_password)
    user.clear_reset_token()
    db.session.commit()

    return jsonify({"message": "Password updated. You can now log in."}), 200
