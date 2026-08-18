import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COUNTIES } from "../data/counties";
import { useWeatherData } from "../hooks/useWeatherData";
import { splitDaily } from "../utils/riskScore";
import ForecastChart from "../components/ForecastChart";

export default function Forecast() {
  const { countyName } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState(16);
  const county = COUNTIES.find((c) => c.name === countyName);
  const { data, status } = useWeatherData(county);

  if (!county) return null;

  return (
    <div>
      <button className="back-link" onClick={() => navigate(`/county/${encodeURIComponent(county.name)}`)}>
        &larr; Back to dashboard
      </button>

      <div className="dash-header">
        <div className="dash-title">
          <div className="icon-badge">📊</div>
          <div>
            <h2>{county.name} forecast</h2>
            <p className="subtitle">Rainfall &amp; temperature outlook</p>
          </div>
        </div>
        <div className="tab-row">
          <button
            className={`tab-btn ${range === 7 ? "active" : ""}`}
            onClick={() => setRange(7)}
          >
            7 days
          </button>
          <button
            className={`tab-btn ${range === 16 ? "active" : ""}`}
            onClick={() => setRange(16)}
          >
            16 days
          </button>
        </div>
      </div>

      {status === "loading" && (
        <div className="state-box">
          <div className="spinner" />
          <p>Loading forecast&hellip;</p>
        </div>
      )}

      {status === "success" && data && (
        <ForecastDetail data={data} range={range} />
      )}
    </div>
  );
}

function ForecastDetail({ data, range }) {
  const { forecast } = splitDaily(data);
  const rows = forecast.slice(0, range);
  const totalRainfall = Math.round(rows.reduce((s, r) => s + r.precipitation, 0) * 10) / 10;
  const avgHumidity = Math.round(rows.reduce((s, r) => s + r.humidity, 0) / rows.length);
  const peakIndex = rows.reduce(
    (best, r, i) => (r.precipitation > rows[best].precipitation ? i : best),
    0
  );

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <span className="title">Rainfall & temperature, next {range} days</span>
        </div>
        <ForecastChart rows={rows} />
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat-card">
          <div className="label">Total rainfall</div>
          <div className="value">{totalRainfall} mm</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg humidity</div>
          <div className="value">{avgHumidity}%</div>
        </div>
        <div className="stat-card">
          <div className="label">Peak rain day</div>
          <div className="value">Day {peakIndex + 1}</div>
        </div>
      </div>
    </>
  );
}
