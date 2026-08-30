from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(50), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    # Password reset support. We store a hash of the reset token (never the
    # raw token) plus its expiry, mirroring how passwords themselves are
    # hashed — a DB leak shouldn't hand out usable reset links.
    reset_token_hash = db.Column(db.String(255), nullable=True)
    reset_token_expires_at = db.Column(db.DateTime(timezone=True), nullable=True)

    watched_counties = db.relationship(
        "WatchedCounty", backref="user", cascade="all, delete-orphan", lazy=True
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def set_reset_token(self, token, expires_at):
        self.reset_token_hash = generate_password_hash(token)
        self.reset_token_expires_at = expires_at

    def check_reset_token(self, token):
        if not self.reset_token_hash or not self.reset_token_expires_at:
            return False
        if utcnow() > self.reset_token_expires_at:
            return False
        return check_password_hash(self.reset_token_hash, token)

    def clear_reset_token(self):
        self.reset_token_hash = None
        self.reset_token_expires_at = None

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "created_at": self.created_at.isoformat(),
        }


class WatchedCounty(db.Model):
    __tablename__ = "watched_counties"
    __table_args__ = (
        db.UniqueConstraint("user_id", "county_name", name="uq_user_county"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    county_name = db.Column(db.String(100), nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    risk_logs = db.relationship(
        "RiskLog", backref="watched_county", cascade="all, delete-orphan", lazy=True,
        order_by="RiskLog.recorded_at.desc()",
    )

    def to_dict(self, include_latest=False):
        data = {
            "id": self.id,
            "county_name": self.county_name,
            "lat": self.lat,
            "lon": self.lon,
            "created_at": self.created_at.isoformat(),
        }
        if include_latest and self.risk_logs:
            data["latest"] = self.risk_logs[0].to_dict()
        return data


class RiskLog(db.Model):
    __tablename__ = "risk_logs"

    id = db.Column(db.Integer, primary_key=True)
    watched_county_id = db.Column(
        db.Integer, db.ForeignKey("watched_counties.id"), nullable=False, index=True
    )
    score = db.Column(db.Integer, nullable=False)
    level = db.Column(db.String(20), nullable=False)
    rainfall = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    temp = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "watched_county_id": self.watched_county_id,
            "score": self.score,
            "level": self.level,
            "rainfall": self.rainfall,
            "humidity": self.humidity,
            "temp": self.temp,
            "recorded_at": self.recorded_at.isoformat(),
        }
