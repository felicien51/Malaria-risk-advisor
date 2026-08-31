def test_register_creates_account_and_returns_token(client):
    resp = client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@example.com", "password": "password123"},
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["token"]
    assert body["user"]["username"] == "alice"
    assert body["user"]["email"] == "alice@example.com"
    # Password must never come back in the response.
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_register_rejects_short_password(client):
    resp = client.post(
        "/api/auth/register",
        json={"username": "bob", "email": "bob@example.com", "password": "short"},
    )
    assert resp.status_code == 400


def test_register_rejects_invalid_username(client):
    resp = client.post(
        "/api/auth/register",
        json={"username": "b!", "email": "bob@example.com", "password": "password123"},
    )
    assert resp.status_code == 400


def test_register_rejects_duplicate_email(client, register_user):
    register_user(email="dup@example.com", username="first")
    resp = client.post(
        "/api/auth/register",
        json={"username": "second", "email": "dup@example.com", "password": "password123"},
    )
    assert resp.status_code == 409


def test_register_rejects_duplicate_username(client, register_user):
    register_user(username="taken", email="a@example.com")
    resp = client.post(
        "/api/auth/register",
        json={"username": "taken", "email": "b@example.com", "password": "password123"},
    )
    assert resp.status_code == 409


def test_login_succeeds_with_correct_credentials(client, register_user):
    register_user(email="carl@example.com", password="password123")
    resp = client.post(
        "/api/auth/login", json={"email": "carl@example.com", "password": "password123"}
    )
    assert resp.status_code == 200
    assert resp.get_json()["token"]


def test_login_rejects_wrong_password(client, register_user):
    register_user(email="dana@example.com", password="password123")
    resp = client.post(
        "/api/auth/login", json={"email": "dana@example.com", "password": "wrongpass"}
    )
    assert resp.status_code == 401


def test_login_rejects_unknown_email(client):
    resp = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "password123"}
    )
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_returns_current_user(client, register_user):
    token, user = register_user(email="erin@example.com")
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.get_json()["email"] == "erin@example.com"


def test_update_me_sets_username_for_legacy_account(client, register_user):
    token, _ = register_user(email="frank@example.com")
    resp = client.patch(
        "/api/auth/me",
        json={"username": "frankly"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["username"] == "frankly"


def test_update_me_rejects_taken_username(client, register_user):
    register_user(username="grace", email="grace@example.com")
    token, _ = register_user(username="henry", email="henry@example.com")
    resp = client.patch(
        "/api/auth/me",
        json={"username": "grace"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


def test_forgot_password_returns_generic_message_for_unknown_email(client):
    resp = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert resp.status_code == 200
    assert "if an account exists" in resp.get_json()["message"].lower()


def test_forgot_password_returns_generic_message_for_known_email(client, register_user):
    register_user(email="ivy@example.com")
    resp = client.post("/api/auth/forgot-password", json={"email": "ivy@example.com"})
    assert resp.status_code == 200
    assert "if an account exists" in resp.get_json()["message"].lower()


def test_reset_password_rejects_invalid_token(client, register_user):
    register_user(email="jack@example.com")
    resp = client.post(
        "/api/auth/reset-password",
        json={"email": "jack@example.com", "token": "not-a-real-token", "password": "newpassword123"},
    )
    assert resp.status_code == 400


def test_full_reset_password_flow(client, register_user, app):
    from app.models import User

    register_user(email="kim@example.com", password="oldpassword1")

    with app.app_context():
        user = User.query.filter_by(email="kim@example.com").first()
        # Generate a token the same way the route does, so this test
        # exercises reset-password without needing to intercept an email.
        import secrets
        from datetime import timedelta
        from app.models import utcnow
        from app.extensions import db

        token = secrets.token_urlsafe(32)
        user.set_reset_token(token, utcnow() + timedelta(minutes=30))
        db.session.commit()

    resp = client.post(
        "/api/auth/reset-password",
        json={"email": "kim@example.com", "token": token, "password": "newpassword123"},
    )
    assert resp.status_code == 200

    # Old password no longer works, new one does.
    resp = client.post(
        "/api/auth/login", json={"email": "kim@example.com", "password": "oldpassword1"}
    )
    assert resp.status_code == 401
    resp = client.post(
        "/api/auth/login", json={"email": "kim@example.com", "password": "newpassword123"}
    )
    assert resp.status_code == 200
