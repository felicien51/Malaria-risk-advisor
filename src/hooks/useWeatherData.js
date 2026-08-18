import { useState, useEffect } from "react";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * Fetches daily weather data (past 14 days + next 16 days forecast) for a
 * given county from the Open-Meteo API. No API key required.
 */
export function useWeatherData(county) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!county) {
      setData(null);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();

    async function fetchWeather() {
      setStatus("loading");
      setError(null);
      try {
        const params = new URLSearchParams({
          latitude: county.lat,
          longitude: county.lon,
          daily: [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "relative_humidity_2m_mean",
            "wind_speed_10m_max",
          ].join(","),
          timezone: "auto",
          forecast_days: 16,
          past_days: 14,
        });

        const response = await fetch(`${BASE_URL}?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Weather service returned ${response.status}`);
        }

        const json = await response.json();
        setData(json);
        setStatus("success");
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Something went wrong fetching weather data");
          setStatus("error");
        }
      }
    }

    fetchWeather();
    return () => controller.abort();
  }, [county]);

  return { data, status, error };
}
