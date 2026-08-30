import requests
from datetime import datetime, timezone

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


class WeatherServiceError(Exception):
    """Raised when the upstream weather API can't be reached or returns bad data."""


def fetch_weather(lat, lon, past_days=14, forecast_days=1, timeout=8):
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": ",".join(
            [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "relative_humidity_2m_mean",
                "wind_speed_10m_max",
            ]
        ),
        "timezone": "auto",
        "past_days": past_days,
        "forecast_days": forecast_days,
    }
    try:
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as exc:
        raise WeatherServiceError(f"Could not reach weather service: {exc}") from exc


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def compute_risk_score(daily_json, past_days=14):
    """Mirrors src/utils/riskScore.js computeRiskScore, so Phase 1 and Phase 2
    produce identical scores from the same weather inputs.

    Bug fix: the weather JSON here covers the full requested window — past
    days AND forecast days (the backend requests forecast_days=16 so the
    dashboard has data for the forecast chart). The frontend's
    computeRiskScore only ever sees the *trailing* slice (splitDaily() cuts
    it before today). This function used to average over the whole array,
    silently blending in up to 16 days of forecast — which skews the score
    away from what the UI shows and what the "Mirrors ..." comment above
    promises. We now slice to the same trailing window the frontend uses
    before computing anything, so a value written to RiskLog always matches
    what the dashboard displays for the same weather snapshot.
    """
    daily = daily_json.get("daily", {})
    dates = daily.get("time", [])
    precip = daily.get("precipitation_sum", [])
    humidity = daily.get("relative_humidity_2m_mean", [])
    tmax = daily.get("temperature_2m_max", [])
    tmin = daily.get("temperature_2m_min", [])

    if not precip or not humidity or not tmax or not tmin:
        raise WeatherServiceError("Weather service returned incomplete data")

    # Find "today" the same way splitDaily() does on the frontend: match
    # today's date string, falling back to the requested past_days count if
    # the date isn't present in the response for some reason.
    today_str = datetime.now(timezone.utc).date().isoformat()
    try:
        today_index = dates.index(today_str)
    except ValueError:
        today_index = past_days

    trailing_slice = slice(0, today_index + 1)

    # Open-Meteo occasionally returns null for the most recent day or two of
    # a field (data not finalized yet). Drop any day where a value is
    # missing rather than letting sum()/division blow up on None.
    rows = [
        (p, h, mx, mn)
        for p, h, mx, mn in zip(
            precip[trailing_slice], humidity[trailing_slice], tmax[trailing_slice], tmin[trailing_slice]
        )
        if p is not None and h is not None and mx is not None and mn is not None
    ]
    if not rows:
        raise WeatherServiceError("Weather service returned no usable data for this period")

    n = len(rows)
    total_rainfall = sum(r[0] for r in rows)
    avg_humidity = sum(r[1] for r in rows) / n
    avg_temp = sum((r[2] + r[3]) / 2 for r in rows) / n

    rainfall_score = _clamp(total_rainfall / 120, 0, 1) * 40
    humidity_score = _clamp((avg_humidity - 40) / 45, 0, 1) * 30

    if 20 <= avg_temp <= 30:
        temp_factor = 1
    elif avg_temp < 20:
        temp_factor = _clamp(1 - (20 - avg_temp) / 10, 0, 1)
    else:
        temp_factor = _clamp(1 - (avg_temp - 30) / 10, 0, 1)
    temperature_score = temp_factor * 30

    score = round(rainfall_score + humidity_score + temperature_score)
    level = "Low"
    if score >= 70:
        level = "High"
    elif score >= 40:
        level = "Moderate"

    return {
        "score": score,
        "level": level,
        "rainfall": round(total_rainfall, 1),
        "humidity": round(avg_humidity),
        "temp": round(avg_temp, 1),
    }
