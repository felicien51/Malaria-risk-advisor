from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from flask_jwt_extended.exceptions import NoAuthorizationError
from google import genai
from google.genai import types
from google.genai.errors import APIError

from ..extensions import limiter
from ..counties import COUNTIES_BY_NAME
from ..weather_service import fetch_weather, compute_risk_score, WeatherServiceError

chat_bp = Blueprint("chat", __name__)

# Kept short and topic-scoped on purpose: this isn't meant to be a general
# assistant, just a focused explainer for the numbers this app already
# shows, so it stays inside what the underlying risk model can actually
# support and doesn't drift into giving medical/diagnostic advice.
SYSTEM_PROMPT = """You are the assistant embedded in Malaria Risk Advisor, a web app that \
estimates malaria risk for counties in Kenya from recent and forecast rainfall, humidity, \
and temperature (higher rainfall/humidity and warmer temperatures raise mosquito breeding \
and survival, and therefore risk).

Answer questions about:
- how to read/interpret the app's risk score and Low/Moderate/High levels
- general malaria prevention (nets, repellents, indoor spraying, standing water, seeking \
testing/treatment for fever)
- what the weather data provided to you implies about a specific county's risk

Stay within that scope. If asked something unrelated to malaria risk or prevention, say \
that's outside what you can help with here. You are not a doctor: for symptoms, diagnosis, \
or treatment decisions, tell the person to see a healthcare provider or contact local health \
services. Keep answers brief (a few sentences to a short paragraph) and avoid repeating the \
raw numbers back verbatim if they're already shown on screen — interpret them instead."""

MAX_HISTORY_MESSAGES = 8
MAX_MESSAGE_LENGTH = 1000


def _build_context_block(county_name):
    """Best-effort: if the frontend tells us which county the user is
    looking at, fetch the same live weather/risk data the dashboard shows
    so the model's answer lines up with what's on screen. Any failure here
    just means the model answers without that context, not a hard error."""
    if not county_name:
        return None
    county = COUNTIES_BY_NAME.get(county_name)
    if not county:
        return None
    try:
        weather = fetch_weather(county["lat"], county["lon"], past_days=14, forecast_days=1)
        risk = compute_risk_score(weather, past_days=14)
    except WeatherServiceError:
        return None
    return (
        f"Current data for {county_name}: risk score {risk['score']}/100 ({risk['level']}), "
        f"recent rainfall {risk['rainfall']}mm, humidity {risk['humidity']}%, "
        f"temperature {risk['temp']}°C."
    )


@chat_bp.post("/message")
@limiter.limit("15 per minute")
def send_message():
    if not current_app.config.get("GEMINI_API_KEY"):
        return jsonify({"error": "The chat assistant isn't configured on this server."}), 503

    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    county_name = data.get("county_name")
    history = data.get("history") or []

    if not message:
        return jsonify({"error": "A message is required"}), 400
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": f"Message is too long (max {MAX_MESSAGE_LENGTH} characters)"}), 400
    if not isinstance(history, list):
        return jsonify({"error": "history must be a list"}), 400

    # Optional auth: works for anonymous visitors, but a logged-in user's id
    # is available here if we ever want per-user chat rate limits or logs.
    try:
        verify_jwt_in_request(optional=True)
        get_jwt_identity()
    except NoAuthorizationError:
        pass

    # Only trust role/content from prior turns; cap length so a long-running
    # conversation can't grow the request (and cost) without bound. Gemini
    # uses "model" rather than "assistant" for the bot's turns, so the
    # frontend's "assistant" role is translated here.
    trimmed_history = []
    for entry in history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(entry, dict):
            continue
        role = entry.get("role")
        content = str(entry.get("content") or "")[:MAX_MESSAGE_LENGTH]
        if role == "user" and content:
            trimmed_history.append({"role": "user", "parts": [{"text": content}]})
        elif role == "assistant" and content:
            trimmed_history.append({"role": "model", "parts": [{"text": content}]})

    system_prompt = SYSTEM_PROMPT
    context_block = _build_context_block(county_name)
    if context_block:
        system_prompt += f"\n\n{context_block}"

    contents = trimmed_history + [{"role": "user", "parts": [{"text": message}]}]

    try:
        client = genai.Client(api_key=current_app.config["GEMINI_API_KEY"])
        response = client.models.generate_content(
            model=current_app.config["CHAT_MODEL"],
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=400,
            ),
        )
    except APIError:
        return jsonify({"error": "The chat assistant is temporarily unavailable. Please try again."}), 502

    reply = (response.text or "").strip()
    if not reply:
        return jsonify({"error": "The chat assistant is temporarily unavailable. Please try again."}), 502

    return jsonify({"reply": reply}), 200
