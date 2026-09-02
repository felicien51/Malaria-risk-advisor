from app.extensions import db
from app.models import User


def _make_admin(email):
    user = User.query.filter_by(email=email).first()
    user.is_admin = True
    db.session.commit()


def test_non_admin_cannot_list_users(app, client, register_user):
    token, _ = register_user()
    resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_unauthenticated_cannot_list_users(client):
    resp = client.get("/api/admin/users")
    assert resp.status_code == 401


def test_admin_can_list_users(app, client, register_user):
    token, user = register_user(email="admin@example.com", username="admino")
    with app.app_context():
        _make_admin("admin@example.com")

    resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["total"] == 1
    assert body["users"][0]["email"] == "admin@example.com"


def test_admin_can_view_stats(app, client, register_user):
    token, _ = register_user(email="admin@example.com", username="admino")
    with app.app_context():
        _make_admin("admin@example.com")

    resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["total_users"] == 1
    assert body["total_admins"] == 1


def test_admin_can_promote_another_user(app, client, register_user):
    admin_token, _ = register_user(email="admin@example.com", username="admino")
    _, other_user = register_user(email="other@example.com", username="other")
    with app.app_context():
        _make_admin("admin@example.com")

    resp = client.patch(
        f"/api/admin/users/{other_user['id']}/role",
        json={"is_admin": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["is_admin"] is True


def test_admin_cannot_demote_self(app, client, register_user):
    admin_token, admin_user = register_user(email="admin@example.com", username="admino")
    with app.app_context():
        _make_admin("admin@example.com")

    resp = client.patch(
        f"/api/admin/users/{admin_user['id']}/role",
        json={"is_admin": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400


def test_admin_can_delete_another_user(app, client, register_user):
    admin_token, _ = register_user(email="admin@example.com", username="admino")
    _, other_user = register_user(email="other@example.com", username="other")
    with app.app_context():
        _make_admin("admin@example.com")

    resp = client.delete(
        f"/api/admin/users/{other_user['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200

    list_resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp.get_json()["total"] == 1


def test_admin_cannot_delete_self(app, client, register_user):
    admin_token, admin_user = register_user(email="admin@example.com", username="admino")
    with app.app_context():
        _make_admin("admin@example.com")

    resp = client.delete(
        f"/api/admin/users/{admin_user['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
