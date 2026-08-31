from datetime import datetime, timedelta, timezone

from app.weather_service import compute_risk_score


def _build_daily_json(trailing_days, forecast_days):
    """Builds a synthetic Open-Meteo-shaped payload: `trailing_days` rows
    ending on today, followed by `forecast_days` rows after today. Each
    argument is a list of (precip, humidity, tmax, tmin) tuples.
    """
    today = datetime.now(timezone.utc).date()
    n_trailing = len(trailing_days)
    n_forecast = len(forecast_days)

    dates = (
        [(today - timedelta(days=n_trailing - 1 - i)).isoformat() for i in range(n_trailing)]
        + [(today + timedelta(days=i + 1)).isoformat() for i in range(n_forecast)]
    )
    rows = trailing_days + forecast_days

    return {
        "daily": {
            "time": dates,
            "precipitation_sum": [r[0] for r in rows],
            "relative_humidity_2m_mean": [r[1] for r in rows],
            "temperature_2m_max": [r[2] for r in rows],
            "temperature_2m_min": [r[3] for r in rows],
        }
    }


def test_compute_risk_score_matches_hand_calculated_value():
    """Fixed, hand-verified inputs -> fixed expected output. If this ever
    changes, it means the scoring formula itself changed — the frontend's
    src/utils/riskScore.js computeRiskScore should be updated to match, and
    this fixture (plus its expected numbers) updated deliberately, not as
    an incidental side effect of an unrelated change."""
    trailing = [(5.0, 70.0, 28.0, 22.0)] * 15  # 15 days: today + 14 trailing
    daily_json = _build_daily_json(trailing, forecast_days=[])

    result = compute_risk_score(daily_json, past_days=14)

    assert result == {"score": 75, "level": "High", "rainfall": 75.0, "humidity": 70, "temp": 25.0}


def test_compute_risk_score_ignores_forecast_days():
    """Regression test for the bug where forecast days leaked into the
    average: a backend call that includes 15 days of much heavier
    rain/humidity in the *forecast* portion must produce the same score as
    if those forecast days weren't there at all, because only the trailing
    window (past days + today) should ever be averaged."""
    trailing = [(5.0, 70.0, 28.0, 22.0)] * 15
    heavy_forecast = [(50.0, 95.0, 30.0, 24.0)] * 15

    trailing_only = compute_risk_score(_build_daily_json(trailing, []), past_days=14)
    with_forecast = compute_risk_score(_build_daily_json(trailing, heavy_forecast), past_days=14)

    assert trailing_only == with_forecast


def test_compute_risk_score_skips_missing_days():
    trailing = [(5.0, 70.0, 28.0, 22.0)] * 14 + [(None, None, None, None)]
    daily_json = _build_daily_json(trailing, forecast_days=[])

    result = compute_risk_score(daily_json, past_days=14)

    # The one day with nulls should simply be dropped, not crash or corrupt
    # the average — expected value reflects the 14 valid days only
    # (rainfall totals lower than the 15-day fixture above since one day's
    # rain is excluded, not zeroed).
    assert result == {"score": 73, "level": "High", "rainfall": 70.0, "humidity": 70, "temp": 25.0}


def test_compute_risk_score_raises_on_no_usable_data():
    from app.weather_service import WeatherServiceError
    import pytest

    daily_json = _build_daily_json([(None, None, None, None)] * 5, forecast_days=[])
    with pytest.raises(WeatherServiceError):
        compute_risk_score(daily_json, past_days=14)


def test_compute_risk_score_low_risk_conditions():
    # Dry, cool, low-humidity trailing window should land in Low.
    trailing = [(0.0, 30.0, 18.0, 12.0)] * 15
    daily_json = _build_daily_json(trailing, forecast_days=[])

    result = compute_risk_score(daily_json, past_days=14)

    assert result["level"] == "Low"
