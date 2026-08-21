import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COUNTIES } from "../data/counties";
import { useWeatherData } from "../hooks/useWeatherData";
import { splitDaily, computeRiskScore, computeTrend } from "../utils/riskScore";
import { useRecentCounties } from "../hooks/useRecentCounties";
import { useSessionRiskLog } from "../hooks/useSessionRiskLog";
import { useRiskNotifications } from "../hooks/useRiskNotifications";
import { usePreferences, formatTemp, formatRainfall } from "../context/PreferencesContext.jsx";
import { downloadRiskCard } from "../utils/downloadCard";
import RiskGauge from "../components/RiskGauge";
import ForecastChart from "../components/ForecastChart";
import Sparkline from "../components/Sparkline";

const TREND_LABEL = { rising: "Rising", falling: "Falling", steady: "Steady" };

export default function Dashboard() {
  const { countyName } = useParams();
  const navigate = useNavigate();
  const county = COUNTIES.find((c) => c.name === countyName);
  const { data, status, error } = useWeatherData(county);
  const { addRecent } = useRecentCounties();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (county) addRecent(county.name);
  }, [county, addRecent]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  if (!county) {
    return (
      <div className="state-box">
        <p>County not found.</p>
        <button className="retry-btn" onClick={() => navigate("/")}>
          Back to county list
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate("/")}>
        &larr; Change county
      </button>

      <div className="dash-header">
        <div className="dash-title">
          <div className="icon-badge" aria-hidden="true">🩺</div>
          <div>
            <h2>Malaria risk advisor</h2>
            <p className="subtitle">{county.name} county</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="icon-btn" onClick={handleShare} aria-label="Copy shareable link">
            🔗 Share
          </button>
          <select
            className="county-select"
            value={county.name}
            onChange={(e) => navigate(`/county/${encodeURIComponent(e.target.value)}`)}
            aria-label="Select county"
          >
            {COUNTIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} county
              </option>
            ))}
          </select>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {copied && <div className="copy-toast">Link copied to clipboard</div>}
      </div>

      {status === "loading" && (
        <div className="state-box" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Fetching weather data for {county.name}&hellip;</p>
        </div>
      )}

      {status === "error" && (
        <div className="state-box" role="alert">
          <p>Couldn&apos;t load weather data{error ? `: ${error}` : "."}</p>
          <button className="retry-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {status === "success" && data && (
        <DashboardContent data={data} countyName={county.name} navigate={navigate} />
      )}
    </div>
  );
}

function DashboardContent({ data, countyName, navigate }) {
  const { trailing, forecast } = splitDaily(data);
  const risk = computeRiskScore(trailing);
  const trend = computeTrend(trailing);
  const { units } = usePreferences();
  const { history, record } = useSessionRiskLog(countyName);
  const { enabled: notifyEnabled, permission, toggle: toggleNotify, checkAndNotify } =
    useRiskNotifications(countyName);

  useEffect(() => {
    record(risk.score);
    checkAndNotify(risk.level, risk.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk.score]);

  const handleDownload = () => {
    downloadRiskCard({
      countyName,
      score: risk.score,
      level: risk.level,
      rainfall: formatRainfall(risk.totalRainfall, units),
      humidity: `${risk.avgHumidity}%`,
      temp: formatTemp(risk.avgTemp, units),
    });
  };

  return (
    <>
      <div className="dash-grid">
        <RiskGauge score={risk.score} level={risk.level} />
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">💧 Rainfall, 14d</div>
            <div className="value">{formatRainfall(risk.totalRainfall, units)}</div>
          </div>
          <div className="stat-card">
            <div className="label">🌫️ Avg humidity</div>
            <div className="value">{risk.avgHumidity}%</div>
          </div>
          <div className="stat-card">
            <div className="label">🌡️ Avg temp</div>
            <div className="value">{formatTemp(risk.avgTemp, units)}</div>
          </div>
          <div className="stat-card">
            <div className="label">📈 14d trend</div>
            <div className="value">{TREND_LABEL[trend]}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <button className="retry-btn" onClick={handleDownload}>
          ⬇ Download card
        </button>
        {typeof Notification !== "undefined" && (
          <button
            className="retry-btn"
            onClick={toggleNotify}
            disabled={permission === "denied"}
            aria-pressed={notifyEnabled}
            title={permission === "denied" ? "Notifications blocked in browser settings" : undefined}
          >
            {notifyEnabled ? "🔔 Notifications on" : "🔕 Notify me if High"}
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="title">This session</span>
        </div>
        <div className="sparkline-row">
          <Sparkline points={history} />
          <span style={{ fontSize: "0.78rem", color: "rgba(var(--paper-rgb),0.55)" }}>
            Risk score seen so far this visit (resets on reload)
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="title">16-day forecast</span>
          <div className="legend">
            <span>
              <span className="dot" style={{ background: "#4a7a9c" }} /> rainfall
            </span>
            <span>
              <span className="dot" style={{ background: "#c15b3a" }} /> temperature
            </span>
          </div>
        </div>
        <ForecastChart rows={forecast} />
        <button
          className="retry-btn"
          style={{ marginTop: "0.75rem" }}
          onClick={() => navigate(`/county/${encodeURIComponent(countyName)}/forecast`)}
        >
          View detailed forecast &rarr;
        </button>
      </div>

      <div className="disclaimer">ⓘ Educational estimate, not a medical diagnosis</div>
    </>
  );
}
