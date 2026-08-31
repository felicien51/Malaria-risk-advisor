import pytest

from app import create_app
from app.extensions import db as _db


@pytest.fixture
def app():
    application = create_app("config.TestConfig")
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def register_user(client):
    """Registers a user and returns (token, user_dict). Call with kwargs to
    override username/email/password."""
    def _register(username="tester", email="tester@example.com", password="testpass987"):
        resp = client.post(
            "/api/auth/register",
            json={"username": username, "email": email, "password": password},
        )
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        return body["token"], body["user"]

    return _register
