from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import User, WatchedCounty, RiskLog

admin_bp = Blueprint("admin", __name__)


def admin_required(fn):
    """Stacks on top of @jwt_required(): rejects any authenticated user
    whose account isn't flagged is_admin, before the view body runs."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or not user.is_admin:
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


@admin_bp.get("/users")
@admin_required
def list_users():
    """Paginated list of all accounts, most recent first."""
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 25, type=int), 100)

    query = User.query.order_by(User.created_at.desc())
    total = query.count()
    users = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        "users": [u.to_dict() for u in users],
        "page": page,
        "per_page": per_page,
        "total": total,
    }), 200


@admin_bp.get("/stats")
@admin_required
def stats():
    """High-level counts for an admin dashboard landing view."""
    return jsonify({
        "total_users": User.query.count(),
        "total_admins": User.query.filter_by(is_admin=True).count(),
        "total_watched_counties": WatchedCounty.query.count(),
        "total_risk_logs": RiskLog.query.count(),
    }), 200


@admin_bp.patch("/users/<int:user_id>/role")
@admin_required
def set_admin_role(user_id):
    """Promote or demote a user. Body: {"is_admin": true|false}."""
    current_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    if "is_admin" not in data or not isinstance(data["is_admin"], bool):
        return jsonify({"error": "is_admin (boolean) is required"}), 400

    if int(user_id) == int(current_id) and not data["is_admin"]:
        return jsonify({"error": "You can't remove your own admin access"}), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.is_admin = data["is_admin"]
    db.session.commit()
    return jsonify(user.to_dict()), 200


@admin_bp.delete("/users/<int:user_id>")
@admin_required
def delete_user(user_id):
    """Removes an account entirely. Cascades to their watched counties and
    risk logs via the model relationship's cascade="all, delete-orphan"."""
    current_id = get_jwt_identity()
    if int(user_id) == int(current_id):
        return jsonify({"error": "You can't delete your own account here"}), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted"}), 200
