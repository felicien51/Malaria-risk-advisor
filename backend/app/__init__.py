from flask import Flask, jsonify
from flask_cors import CORS
from .extensions import db, migrate, jwt, limiter


def create_app(config_object="config.Config"):
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)

    from .models import User

    @jwt.token_in_blocklist_loader
    def check_token_version(jwt_header, jwt_payload):
        """Rejects tokens issued before the user's last password change or
        'log out everywhere' action, even if the token hasn't expired yet.
        Named to match Flask-JWT-Extended's expected blocklist-callback
        signature, but the check is version-based rather than a literal
        denylist of token ids."""
        user = db.session.get(User, jwt_payload["sub"])
        if user is None:
            return True
        return jwt_payload.get("token_version") != user.token_version

    from .routes.auth import auth_bp
    from .routes.watchlist import watchlist_bp
    from .routes.risk import risk_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(watchlist_bp, url_prefix="/api/watchlist")
    app.register_blueprint(risk_bp, url_prefix="/api")

    register_error_handlers(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


def register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(422)
    def unprocessable(e):
        return jsonify({"error": "Unprocessable entity"}), 422

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500
