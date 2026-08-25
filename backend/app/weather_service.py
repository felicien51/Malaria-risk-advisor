import requests

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


def compute_risk_score(daily_json):
    """Mirrors src/utils/riskScore.js computeRiskScore, so Phase 1 and Phase 2
    produce identical scores from the same weather inputs."""
    daily = daily_json.get("daily", {})
    precip = daily.get("precipitation_sum", [])
    humidity = daily.get("relative_humidity_2m_mean", [])
    tmax = daily.get("temperature_2m_max", [])
    tmin = daily.get("temperature_2m_min", [])

    if not precip or not humidity or not tmax or not tmin:
        raise WeatherServiceError("Weather service returned incomplete data")

    # Open-Meteo occasionally returns null for the most recent day or two of
    # a field (data not finalized yet). Drop any day where a value is
    # missing rather than letting sum()/division blow up on None.
    rows = [
        (p, h, mx, mn)
        for p, h, mx, mn in zip(precip, humidity, tmax, tmin)
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
