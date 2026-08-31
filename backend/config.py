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
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Gmail SMTP for password-reset emails. MAIL_USERNAME must be a full
    # Gmail address; MAIL_PASSWORD must be a 16-character Gmail "App
    # Password" (Google Account -> Security -> 2-Step Verification -> App
    # passwords) — NOT your normal Gmail login password, which Google
    # blocks for SMTP. If MAIL_USERNAME/MAIL_PASSWORD aren't set, the app
    # falls back to logging the reset link instead of emailing it (see
    # send_password_reset_email in routes/auth.py) so local dev still works
    # without SMTP credentials.
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", MAIL_USERNAME)

    # Flask-Limiter storage backend. In-memory is fine for a single dev/demo
    # process; set RATELIMIT_STORAGE_URI to a shared Redis URL in production
    # so limits are enforced consistently across multiple workers/dynos.
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # Password reset tokens are short-lived by design.
    PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = int(
        os.environ.get("PASSWORD_RESET_TOKEN_EXPIRES_MINUTES", "30")
    )
