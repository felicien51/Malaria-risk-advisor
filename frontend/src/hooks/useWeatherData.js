import { useState, useEffect } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Fetches daily weather + risk data for a given county from our own Flask
 * backend (which in turn calls Open-Meteo server-side). If the user is
 * logged in and has this county watchlisted, the backend also logs a
 * RiskLog entry automatically.
 *
 * Returns data shaped as { daily: {...} } — the same shape Phase 1's direct
 * Open-Meteo response had — so splitDaily/computeRiskScore/ForecastChart
 * downstream are unaffected by the switch to a backend-owned data source.
 */
export function useWeatherData(county) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!county) {
      setData(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;

    async function fetchWeather() {
      setStatus("loading");
      setError(null);
      try {
        const result = await api.getRisk(county.name, token);
        if (cancelled) return;
        setData({ daily: result.forecast });
        setStatus("success");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Something went wrong fetching weather data");
        setStatus("error");
      }
    }

    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, [county, token]);

  return { data, status, error };
}
