import { useNavigate, useParams } from "react-router-dom";
import { COUNTIES } from "../data/counties";
import { useWeatherData } from "../hooks/useWeatherData";
import { splitDaily, computeRiskScore, computeTrend } from "../utils/riskScore";
import RiskGauge from "../components/RiskGauge";
import ForecastChart from "../components/ForecastChart";

const TREND_LABEL = { rising: "Rising", falling: "Falling", steady: "Steady" };

export default function Dashboard() {
  const { countyName } = useParams();
  const navigate = useNavigate();
  const county = COUNTIES.find((c) => c.name === countyName);
  const { data, status, error } = useWeatherData(county);

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
          <div className="icon-badge">🩺</div>
          <div>
            <h2>Malaria risk advisor</h2>
            <p className="subtitle">{county.name} county</p>
          </div>
        </div>
        <select
          className="county-select"
          value={county.name}
          onChange={(e) => navigate(`/county/${encodeURIComponent(e.target.value)}`)}
        >
          {COUNTIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} county
            </option>
          ))}
        </select>
      </div>

      {status === "loading" && (
        <div className="state-box">
          <div className="spinner" />
          <p>Fetching weather data for {county.name}&hellip;</p>
        </div>
      )}

      {status === "error" && (
        <div className="state-box">
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

  return (
    <>
      <div className="dash-grid">
        <RiskGauge score={risk.score} level={risk.level} />
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">💧 Rainfall, 14d</div>
            <div className="value">{risk.totalRainfall} mm</div>
          </div>
          <div className="stat-card">
            <div className="label">🌫️ Avg humidity</div>
            <div className="value">{risk.avgHumidity}%</div>
          </div>
          <div className="stat-card">
            <div className="label">🌡️ Avg temp</div>
            <div className="value">{risk.avgTemp}&deg;C</div>
          </div>
          <div className="stat-card">
            <div className="label">📈 14d trend</div>
            <div className="value">{TREND_LABEL[trend]}</div>
          </div>
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
