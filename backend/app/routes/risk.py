from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_jwt_extended.exceptions import NoAuthorizationError
from ..extensions import db
from ..models import WatchedCounty, RiskLog
from ..counties import COUNTIES_BY_NAME
from ..weather_service import fetch_weather, compute_risk_score, WeatherServiceError

risk_bp = Blueprint("risk", __name__)


@risk_bp.get("/counties/<county_name>/risk")
def county_risk(county_name):
    """Public endpoint: anyone can check a county's current risk without an
    account, matching Phase 1 behavior. If the caller is logged in AND
    already has this county on their watchlist, the result is also logged
    to RiskLog so their history accumulates automatically."""
    county = COUNTIES_BY_NAME.get(county_name)
    if not county:
        return jsonify({"error": "Unknown county name"}), 404

    try:
        weather = fetch_weather(county["lat"], county["lon"], past_days=14, forecast_days=16)
        risk = compute_risk_score(weather, past_days=14)
    except WeatherServiceError as exc:
        return jsonify({"error": str(exc)}), 502

    # Optional auth: log a RiskLog entry only if a valid token was sent and
    # this county is on that user's watchlist.
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
    except NoAuthorizationError:
        user_id = None

    if user_id:
        watched = WatchedCounty.query.filter_by(user_id=user_id, county_name=county_name).first()
        if watched:
            log = RiskLog(
                watched_county_id=watched.id,
                score=risk["score"],
                level=risk["level"],
                rainfall=risk["rainfall"],
                humidity=risk["humidity"],
                temp=risk["temp"],
            )
            db.session.add(log)
            db.session.commit()

    return jsonify({"county_name": county_name, "risk": risk, "forecast": weather.get("daily", {})}), 200
