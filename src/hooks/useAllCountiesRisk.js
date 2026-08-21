import { useState, useEffect, useRef } from "react";
import { COUNTIES } from "../data/counties";
import { splitDaily, computeRiskScore } from "../utils/riskScore";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const BATCH_SIZE = 8; // small concurrent batches instead of 47 at once

async function fetchCountyRisk(county, signal) {
  const params = new URLSearchParams({
    latitude: county.lat,
    longitude: county.lon,
    daily: ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "relative_humidity_2m_mean"].join(","),
    timezone: "auto",
    forecast_days: 1,
    past_days: 14,
  });
  const res = await fetch(`${BASE_URL}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error("fetch failed");
  const json = await res.json();
  const { trailing } = splitDaily(json);
  return computeRiskScore(trailing);
}

// Fetches risk scores for every county in small batches, updating state
// progressively so the map can render dots as results arrive rather than
// blocking on all 47 requests at once.
export function useAllCountiesRisk() {
  const [results, setResults] = useState({}); // { [countyName]: { score, level } | "error" }
  const [loadedCount, setLoadedCount] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();

    async function run() {
      for (let i = 0; i < COUNTIES.length; i += BATCH_SIZE) {
        const batch = COUNTIES.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(
          batch.map((c) => fetchCountyRisk(c, controller.signal))
        );
        setResults((prev) => {
          const next = { ...prev };
          batch.forEach((c, idx) => {
            const r = settled[idx];
            next[c.name] = r.status === "fulfilled" ? r.value : "error";
          });
          return next;
        });
        setLoadedCount((n) => n + batch.length);
      }
    }
    run();
    return () => controller.abort();
  }, []);

  return { results, loadedCount, total: COUNTIES.length };
}
