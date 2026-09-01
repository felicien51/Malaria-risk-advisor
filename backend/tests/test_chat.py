from unittest.mock import patch, MagicMock

import requests


def _fake_gemini_response(text="Nets and repellents are your best first line of defense."):
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": text}]}}]
    }
    mock_resp.text = "{}"
    return mock_resp


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

    with patch("app.routes.chat.requests.post", return_value=_fake_gemini_response()):
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

    with patch("app.routes.chat.requests.post", return_value=_fake_gemini_response()) as mock_post, \
         patch("app.routes.chat.fetch_weather", return_value=fake_weather), \
         patch("app.routes.chat.compute_risk_score", return_value=fake_risk):
        resp = client.post(
            "/api/chat/message",
            json={"message": "Why is my risk moderate?", "county_name": "Kisumu"},
        )
        assert resp.status_code == 200
        _, kwargs = mock_post.call_args
        assert "Moderate" in kwargs["json"]["systemInstruction"]["parts"][0]["text"]


def test_message_handles_upstream_api_error(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()

    with patch("app.routes.chat.requests.post", side_effect=requests.ConnectionError("boom")):
        resp = client.post("/api/chat/message", json={"message": "Hello"})

    assert resp.status_code == 502


def test_message_handles_bad_status_from_gemini(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()

    mock_resp = MagicMock()
    mock_resp.raise_for_status.side_effect = requests.HTTPError("404 model not found")
    mock_resp.text = '{"error": {"code": 404, "message": "model not found"}}'

    with patch("app.routes.chat.requests.post", return_value=mock_resp):
        resp = client.post("/api/chat/message", json={"message": "Hello"})

    assert resp.status_code == 502


def test_message_trims_history_and_ignores_bad_entries(app):
    app.config["GEMINI_API_KEY"] = "test-key"
    client = app.test_client()

    long_history = [{"role": "user", "content": f"msg {i}"} for i in range(20)]
    long_history.append({"role": "system", "content": "should be dropped"})

    with patch("app.routes.chat.requests.post", return_value=_fake_gemini_response()) as mock_post:
        resp = client.post(
            "/api/chat/message", json={"message": "and now?", "history": long_history}
        )
        assert resp.status_code == 200
        _, kwargs = mock_post.call_args
        contents = kwargs["json"]["contents"]
        # The system-role entry falls inside the last-8 slice and gets
        # filtered out for having a disallowed role, leaving 7 valid
        # history entries + the new user message.
        assert len(contents) == 8
        assert all(m["role"] in ("user", "model") for m in contents)
