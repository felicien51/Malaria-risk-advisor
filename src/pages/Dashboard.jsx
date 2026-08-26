import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COUNTIES } from "../data/counties";
import { useWeatherData } from "../hooks/useWeatherData";
import { splitDaily, computeRiskScore, computeTrend } from "../utils/riskScore";
import { useRecentCounties } from "../hooks/useRecentCounties";
import { useSessionRiskLog } from "../hooks/useSessionRiskLog";
import { useRiskNotifications } from "../hooks/useRiskNotifications";
import { usePreferences, formatTemp, formatRainfall } from "../context/PreferencesContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, ApiError } from "../api/client";
import { downloadRiskCard } from "../utils/downloadCard";
import RiskGauge from "../components/RiskGauge";
import ForecastChart from "../components/ForecastChart";
import Sparkline from "../components/Sparkline";

export default function Dashboard() {
  const { countyName } = useParams();
  const navigate = useNavigate();
  const county = COUNTIES.find((c) => c.name === countyName);
  const { data, status, error } = useWeatherData(county);
  const { addRecent } = useRecentCounties();
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();

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
        <p>{t("countyNotFound")}</p>
        <button className="retry-btn" onClick={() => navigate("/")}>
          {t("backToList")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate("/")}>
        &larr; {t("changeCounty")}
      </button>

      <div className="dash-header">
        <div className="dash-title">
          <div className="icon-badge" aria-hidden="true">🩺</div>
          <div>
            <h2>{t("dashTitle")}</h2>
            <p className="subtitle">{county.name} county</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="icon-btn" onClick={handleShare} aria-label={t("share")}>
            🔗 {t("share")}
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
        {copied && <div className="copy-toast">{t("linkCopied")}</div>}
      </div>

      {status === "loading" && (
        <div className="state-box" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>{t("fetching", { county: county.name })}</p>
        </div>
      )}

      {status === "error" && (
        <div className="state-box" role="alert">
          <p>{t("errorLoad")}{error ? `: ${error}` : "."}</p>
          <button className="retry-btn" onClick={() => window.location.reload()}>
            {t("retry")}
          </button>
        </div>
      )}

      {status === "success" && data && (
        <DashboardContent data={data} countyName={county.name} navigate={navigate} t={t} />
      )}
    </div>
  );
}

function SaveToWatchlistButton({ countyName }) {
  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState("idle"); // idle | saving | saved | error
  const [message, setMessage] = useState(null);

  if (!isAuthenticated) {
    return (
      <button className="retry-btn" onClick={() => navigate("/login")}>
        📌 Log in to save
      </button>
    );
  }

  const handleSave = async () => {
    setState("saving");
    setMessage(null);
    try {
      await api.addToWatchlist(countyName, token);
      setState("saved");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setState("saved"); // already on watchlist — same end state
      } else {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "Couldn't save this county.");
      }
    }
  };

  if (state === "saved") {
    return <button className="retry-btn" disabled>✓ Saved to watchlist</button>;
  }

  return (
    <>
      <button className="retry-btn" onClick={handleSave} disabled={state === "saving"}>
        {state === "saving" ? "Saving…" : "📌 Save to watchlist"}
      </button>
      {message && <span style={{ fontSize: "0.78rem", color: "var(--risk-high)" }}>{message}</span>}
    </>
  );
}

function DashboardContent({ data, countyName, navigate, t }) {
  const { trailing, forecast } = splitDaily(data);
  const risk = computeRiskScore(trailing);
  const trend = computeTrend(trailing);
  const { units } = usePreferences();
  const { history, record } = useSessionRiskLog(countyName);
  const { enabled: notifyEnabled, permission, toggle: toggleNotify, checkAndNotify } =
    useRiskNotifications(countyName);

  const TREND_LABEL = { rising: t("trendRising"), falling: t("trendFalling"), steady: t("trendSteady") };

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
            <div className="label">💧 {t("rainfall14d")}</div>
            <div className="value">{formatRainfall(risk.totalRainfall, units)}</div>
          </div>
          <div className="stat-card">
            <div className="label">🌫️ {t("avgHumidity")}</div>
            <div className="value">{risk.avgHumidity}%</div>
          </div>
          <div className="stat-card">
            <div className="label">🌡️ {t("avgTemp")}</div>
            <div className="value">{formatTemp(risk.avgTemp, units)}</div>
          </div>
          <div className="stat-card">
            <div className="label">📈 {t("trend14d")}</div>
            <div className="value">{TREND_LABEL[trend]}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem" }}>
        <SaveToWatchlistButton countyName={countyName} />
        <button className="retry-btn" onClick={handleDownload}>
          ⬇ {t("download")}
        </button>
        {typeof Notification !== "undefined" && (
          <button
            className="retry-btn"
            onClick={toggleNotify}
            disabled={permission === "denied"}
            aria-pressed={notifyEnabled}
            title={permission === "denied" ? "Notifications blocked in browser settings" : undefined}
          >
            {notifyEnabled ? `🔔 ${t("notifyOn")}` : `🔕 ${t("notify")}`}
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="title">{t("sessionTitle")}</span>
        </div>
        <div className="sparkline-row">
          <Sparkline points={history} />
          <span style={{ fontSize: "0.78rem", color: "rgba(var(--paper-rgb),0.55)" }}>
            {t("sessionDesc")}
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="title">{t("forecastTitle")}</span>
          <div className="legend">
            <span>
              <span className="dot" style={{ background: "#4a7a9c" }} /> {t("rainfallLegend")}
            </span>
            <span>
              <span className="dot" style={{ background: "#c15b3a" }} /> {t("temperatureLegend")}
            </span>
          </div>
        </div>
        <ForecastChart rows={forecast} />
        <button
          className="retry-btn"
          style={{ marginTop: "0.75rem" }}
          onClick={() => navigate(`/county/${encodeURIComponent(countyName)}/forecast`)}
        >
          {t("viewForecast")} &rarr;
        </button>
      </div>

      <div className="disclaimer">ⓘ {t("disclaimer")}</div>
    </>
  );
}
