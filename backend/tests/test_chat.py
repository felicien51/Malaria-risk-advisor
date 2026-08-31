from types import SimpleNamespace
from unittest.mock import patch

from google.genai.errors import APIError


def _fake_response(text="Nets and repellents are your best first line of defense."):
    return SimpleNamespace(text=text)


def test_message_requires_configured_api_key(client):
    # TestConfig leaves GEMINI_API_KEY unset, so the endpoint should fail
    # closed with a clear status rather than crashing on a missing key.
    resp = client.post("/api/chat/message", json={"message": "How do I lower my risk?"})
    assert resp.status_code == 503


def test_message_requires_nonempty_message(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()
    resp = client.post("/api/chat/message", json={"message": "   "})
    assert resp.status_code == 400


def test_message_rejects_overlong_message(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()
    resp = client.post("/api/chat/message", json={"message": "a" * 2000})
    assert resp.status_code == 400


def test_message_returns_reply_from_model(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()

    with patch("app.routes.chat.genai.Client") as MockClient:
        MockClient.return_value.models.generate_content.return_value = _fake_response()
        resp = client.post(
            "/api/chat/message", json={"message": "What can I do to avoid malaria?"}
        )

    assert resp.status_code == 200
    assert "repellents" in resp.get_json()["reply"]


def test_message_includes_county_context_when_weather_available(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()

    fake_weather = {"daily": {"time": ["2026-08-01"], "precipitation_sum": [5]}}
    fake_risk = {"score": 40, "level": "Moderate", "rainfall": 5, "humidity": 60, "temp": 25}

    with patch("app.routes.chat.genai.Client") as MockClient, \
         patch("app.routes.chat.fetch_weather", return_value=fake_weather), \
         patch("app.routes.chat.compute_risk_score", return_value=fake_risk):
        MockClient.return_value.models.generate_content.return_value = _fake_response()
        resp = client.post(
            "/api/chat/message",
            json={"message": "Why is my risk moderate?", "county_name": "Kisumu"},
        )
        assert resp.status_code == 200
        _, kwargs = MockClient.return_value.models.generate_content.call_args
        assert "Moderate" in kwargs["config"].system_instruction


def test_message_handles_upstream_api_error(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()

    with patch("app.routes.chat.genai.Client") as MockClient:
        MockClient.return_value.models.generate_content.side_effect = APIError(
            code=503, response_json={"message": "boom"}
        )
        resp = client.post("/api/chat/message", json={"message": "Hello"})

    assert resp.status_code == 502


def test_message_trims_history_and_ignores_bad_entries(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()

    long_history = [{"role": "user", "content": f"msg {i}"} for i in range(20)]
    long_history.append({"role": "system", "content": "should be dropped"})

    with patch("app.routes.chat.genai.Client") as MockClient:
        MockClient.return_value.models.generate_content.return_value = _fake_response()
        resp = client.post(
            "/api/chat/message", json={"message": "and now?", "history": long_history}
        )
        assert resp.status_code == 200
        _, kwargs = MockClient.return_value.models.generate_content.call_args
        # The system-role entry falls inside the last-8 slice and gets
        # filtered out for having a disallowed role, leaving 7 valid
        # history entries + the new user message.
        assert len(kwargs["contents"]) == 8
        assert all(m["role"] in ("user", "model") for m in kwargs["contents"])
