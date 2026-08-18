// Splits the raw Open-Meteo daily response into "trailing" (past 14 days,
// including today) and "forecast" (today onward) slices, since we request
// past_days=14 and forecast_days=16 in the same call.
export function splitDaily(weatherJson) {
  const daily = weatherJson.daily;
  const dates = daily.time;
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayIndex = dates.indexOf(todayStr);
  if (todayIndex === -1) todayIndex = 14; // fallback: past_days count

  const rows = dates.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max[i],
    tempMin: daily.temperature_2m_min[i],
    tempMean: (daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2,
    precipitation: daily.precipitation_sum[i],
    humidity: daily.relative_humidity_2m_mean[i],
    windMax: daily.wind_speed_10m_max[i],
  }));

  return {
    trailing: rows.slice(0, todayIndex + 1),
    forecast: rows.slice(todayIndex),
    all: rows,
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
  const totalRainfall = trailingRows.reduce((sum, d) => sum + d.precipitation, 0);
  const avgHumidity =
    trailingRows.reduce((sum, d) => sum + d.humidity, 0) / trailingRows.length;
  const avgTemp =
    trailingRows.reduce((sum, d) => sum + d.tempMean, 0) / trailingRows.length;

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
  if (trailingRows.length < 14) return "steady";
  const recent = trailingRows.slice(-7);
  const prior = trailingRows.slice(-14, -7);
  const recentScore = computeRiskScore(recent).score;
  const priorScore = computeRiskScore(prior).score;
  const diff = recentScore - priorScore;
  if (diff >= 8) return "rising";
  if (diff <= -8) return "falling";
  return "steady";
}
