import os
from datetime import timedelta
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, ".env"))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///" + os.path.join(basedir, "dev.db")
    )
    # Render/Heroku-style URLs sometimes start with postgres:// — SQLAlchemy needs postgresql://
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace(
            "postgres://", "postgresql://", 1
        )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-change-me")
    # Short-lived on purpose now that refresh tokens exist (see
    # app/routes/auth.py POST /auth/refresh): a stolen access token is only
    # useful for a few minutes, and the frontend silently exchanges the
    # refresh token for a new one instead of the user needing to log in
    # again every 15 minutes.
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Password reset emails, sent via Brevo's transactional email HTTP API
    # (not raw SMTP — Render's free tier blocks outbound traffic on SMTP
    # ports 25/465/587, but ordinary HTTPS on port 443 is unaffected).
    # BREVO_SENDER_EMAIL must be a verified sender in your Brevo account
    # (Senders, Domains & Dedicated IPs -> Senders). If BREVO_API_KEY isn't
    # set, the app falls back to logging the reset link instead of emailing
    # it (see send_password_reset_email in routes/auth.py) so local dev
    # keeps working without a Brevo account.
    BREVO_API_KEY = os.environ.get("BREVO_API_KEY")
    BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL", "felicienkibet@gmail.com")
    BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME", "Malaria Risk Advisor")

    # Flask-Limiter storage backend. In-memory is fine for a single dev/demo
    # process; set RATELIMIT_STORAGE_URI to a shared Redis URL in production
    # so limits are enforced consistently across multiple workers/dynos.
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # Password reset tokens are short-lived by design.
    PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = int(
        os.environ.get("PASSWORD_RESET_TOKEN_EXPIRES_MINUTES", "30")
    )

    # Chatbot (see app/routes/chat.py). Uses Google's Gemini API, which has
    # a genuinely free tier (no card required) for the Flash models — see
    # https://ai.google.dev/gemini-api/docs/rate-limits. Get a key at
    # https://aistudio.google.com/apikey. Without this set,
    # /api/chat/message returns a 503 rather than crashing, so the rest of
    # the app keeps working even in environments where the chatbot hasn't
    # been configured.
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    CHAT_MODEL = os.environ.get("CHAT_MODEL", "gemini-3.6-flash")


class TestConfig(Config):
    """Used by the pytest suite (tests/conftest.py) — isolated in-memory
    DB, rate limiting off so repeated test requests never trip the same
    limits real users would hit, no outbound email calls."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False
    JWT_SECRET_KEY = "test-jwt-secret"
    SECRET_KEY = "test-secret"
    BREVO_API_KEY = None
    GEMINI_API_KEY = None
