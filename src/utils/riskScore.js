// Splits the raw Open-Meteo daily response into "trailing" (past 14 days,
// including today) and "forecast" (today onward) slices, since we request
// past_days=14 and forecast_days=16 in the same call.
export function splitDaily(weatherJson) {
  const daily = weatherJson?.daily || {};
  const dates = daily.time || [];
  const tempMaxArr = daily.temperature_2m_max || [];
  const tempMinArr = daily.temperature_2m_min || [];
  const precipArr = daily.precipitation_sum || [];
  const humidityArr = daily.relative_humidity_2m_mean || [];
  const windArr = daily.wind_speed_10m_max || [];

  const todayStr = new Date().toISOString().slice(0, 10);
  let todayIndex = dates.indexOf(todayStr);
  if (todayIndex === -1) todayIndex = 14; // fallback: past_days count

  // Open-Meteo occasionally returns null for a field on the most recent
  // day or two (not finalized yet), and some fields may be entirely absent
  // depending on which the backend requested. Missing arrays default to []
  // above; missing individual values here become null and are filtered out
  // wherever they'd break a calculation.
  const rows = dates.map((date, i) => ({
    date,
    tempMax: tempMaxArr[i] ?? null,
    tempMin: tempMinArr[i] ?? null,
    tempMean:
      tempMaxArr[i] != null && tempMinArr[i] != null
        ? (tempMaxArr[i] + tempMinArr[i]) / 2
        : null,
    precipitation: precipArr[i] ?? null,
    humidity: humidityArr[i] ?? null,
    windMax: windArr[i] ?? null,
  }));

  return {
    trailing: rows.slice(0, todayIndex + 1),
    forecast: rows.slice(todayIndex),
    all: rows,
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Keeps only rows with every value this calculation needs — mirrors the
// backend's compute_risk_score, which drops incomplete days rather than
// letting a null propagate into the math.
function completeRows(rows) {
  return rows.filter(
    (r) => r.precipitation != null && r.humidity != null && r.tempMean != null
  );
}

/**
 * Estimates malaria transmission risk from trailing weather conditions.
 * This is a simplified, transparent heuristic based on well-documented
 * environmental drivers of Anopheles mosquito breeding and survival:
 *  - Rainfall creates standing water for larval breeding sites
 *  - Relative humidity above ~60% extends adult mosquito lifespan
 *  - Temperatures of roughly 20-30C speed up parasite development
 * It is an educational estimate, not a diagnostic or medical tool.
 */
export function computeRiskScore(trailingRows) {
  const rows = completeRows(trailingRows);

  if (rows.length === 0) {
    return {
      score: 0,
      level: "Low",
      totalRainfall: 0,
      avgHumidity: 0,
      avgTemp: 0,
      breakdown: { rainfallScore: 0, humidityScore: 0, temperatureScore: 0 },
      incomplete: true,
    };
  }

  const totalRainfall = rows.reduce((sum, d) => sum + d.precipitation, 0);
  const avgHumidity = rows.reduce((sum, d) => sum + d.humidity, 0) / rows.length;
  const avgTemp = rows.reduce((sum, d) => sum + d.tempMean, 0) / rows.length;

  // Rainfall score: 0 at 0mm over 14 days, maxes out around 120mm+
  const rainfallScore = clamp(totalRainfall / 120, 0, 1) * 40;

  // Humidity score: ramps up from 40% to 85%
  const humidityScore = clamp((avgHumidity - 40) / 45, 0, 1) * 30;

  // Temperature score: favorable band is 20-30C, penalized outside it
  let tempFactor;
  if (avgTemp >= 20 && avgTemp <= 30) {
    tempFactor = 1;
  } else if (avgTemp < 20) {
    tempFactor = clamp(1 - (20 - avgTemp) / 10, 0, 1);
  } else {
    tempFactor = clamp(1 - (avgTemp - 30) / 10, 0, 1);
  }
  const temperatureScore = tempFactor * 30;

  const score = Math.round(rainfallScore + humidityScore + temperatureScore);

  let level = "Low";
  if (score >= 70) level = "High";
  else if (score >= 40) level = "Moderate";

  return {
    score,
    level,
    totalRainfall: Math.round(totalRainfall * 10) / 10,
    avgHumidity: Math.round(avgHumidity),
    avgTemp: Math.round(avgTemp * 10) / 10,
    breakdown: {
      rainfallScore: Math.round(rainfallScore),
      humidityScore: Math.round(humidityScore),
      temperatureScore: Math.round(temperatureScore),
    },
  };
}

// Compares the score from the most recent 7 days against the prior 7 days
// within the trailing window to report whether risk is rising or falling.
export function computeTrend(trailingRows) {
  const rows = completeRows(trailingRows);
  if (rows.length < 14) return "steady";
  const recent = rows.slice(-7);
  const prior = rows.slice(-14, -7);
  const recentScore = computeRiskScore(recent).score;
  const priorScore = computeRiskScore(prior).score;
  const diff = recentScore - priorScore;
  if (diff >= 8) return "rising";
  if (diff <= -8) return "falling";
  return "steady";
}
