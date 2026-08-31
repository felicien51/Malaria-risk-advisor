from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import WatchedCounty, RiskLog
from ..counties import COUNTIES_BY_NAME

watchlist_bp = Blueprint("watchlist", __name__)


def _get_owned_or_404(watched_county_id, user_id):
    """Fetch a WatchedCounty only if it belongs to the current user. Returns
    None (not another user's record) if it doesn't exist or isn't theirs —
    this is what enforces per-user ownership on every write."""
    return WatchedCounty.query.filter_by(id=watched_county_id, user_id=user_id).first()


@watchlist_bp.get("")
@jwt_required()
def list_watchlist():
    user_id = get_jwt_identity()
    items = WatchedCounty.query.filter_by(user_id=user_id).order_by(WatchedCounty.created_at.desc()).all()
    return jsonify([w.to_dict(include_latest=True) for w in items]), 200


@watchlist_bp.post("")
@jwt_required()
def add_to_watchlist():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    county_name = (data.get("county_name") or "").strip()

    county = COUNTIES_BY_NAME.get(county_name)
    if not county:
        return jsonify({"error": "Unknown county name"}), 400

    existing = WatchedCounty.query.filter_by(user_id=user_id, county_name=county_name).first()
    if existing:
        return jsonify({"error": "County already on your watchlist"}), 409

    watched = WatchedCounty(
        user_id=user_id,
        county_name=county_name,
        lat=county["lat"],
        lon=county["lon"],
    )
    db.session.add(watched)
    db.session.commit()
    return jsonify(watched.to_dict()), 201


@watchlist_bp.patch("/<int:watched_county_id>")
@jwt_required()
def update_watchlist_item(watched_county_id):
    user_id = get_jwt_identity()
    watched = _get_owned_or_404(watched_county_id, user_id)
    if not watched:
        return jsonify({"error": "Not found"}), 404

    data = request.get_json(silent=True) or {}
    # Only the county itself can be swapped; ownership fields are never
    # client-writable.
    if "county_name" in data:
        county = COUNTIES_BY_NAME.get((data.get("county_name") or "").strip())
        if not county:
            return jsonify({"error": "Unknown county name"}), 400
        watched.county_name = county["name"]
        watched.lat = county["lat"]
        watched.lon = county["lon"]

    db.session.commit()
    return jsonify(watched.to_dict()), 200


@watchlist_bp.delete("/<int:watched_county_id>")
@jwt_required()
def delete_watchlist_item(watched_county_id):
    user_id = get_jwt_identity()
    watched = _get_owned_or_404(watched_county_id, user_id)
    if not watched:
        return jsonify({"error": "Not found"}), 404

    db.session.delete(watched)
    db.session.commit()
    return "", 204


@watchlist_bp.get("/<int:watched_county_id>/history")
@jwt_required()
def watchlist_history(watched_county_id):
    user_id = get_jwt_identity()
    watched = _get_owned_or_404(watched_county_id, user_id)
    if not watched:
        return jsonify({"error": "Not found"}), 404

    logs = (
        RiskLog.query.filter_by(watched_county_id=watched.id)
        .order_by(RiskLog.recorded_at)
        .all()
    )
    return jsonify([log.to_dict() for log in logs]), 200
