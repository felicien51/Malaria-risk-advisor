import { useState } from "react";
import { COUNTIES } from "../data/counties";
import { useWeatherData } from "../hooks/useWeatherData";
import { splitDaily, computeRiskScore } from "../utils/riskScore";
import RiskGauge from "../components/RiskGauge";

const MAX_COMPARE = 3;

export default function Compare() {
  const [selected, setSelected] = useState([]);

  const toggleCounty = (name) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, name];
    });
  };

  return (
    <div>
      <div className="dash-title" style={{ marginBottom: "1rem" }}>
        <div className="icon-badge">⚖️</div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: 0 }}>
            Compare counties
          </h2>
          <p className="subtitle">Pick up to {MAX_COMPARE} to compare side by side</p>
        </div>
      </div>

      <div className="compare-picker">
        {COUNTIES.map((c) => (
          <button
            key={c.name}
            className="tab-btn"
            style={selected.includes(c.name) ? { background: "var(--ochre-500)", borderColor: "var(--ochre-500)", color: "var(--ink-950)" } : undefined}
            onClick={() => toggleCounty(c.name)}
            disabled={!selected.includes(c.name) && selected.length >= MAX_COMPARE}
          >
            {c.name}
          </button>
        ))}
      </div>

      {selected.length === 0 && (
        <p className="county-count">Select a county above to get started</p>
      )}

      <div className="compare-grid">
        {selected.map((name) => (
          <CompareCard key={name} countyName={name} />
        ))}
      </div>
    </div>
  );
}

function CompareCard({ countyName }) {
  const county = COUNTIES.find((c) => c.name === countyName);
  const { data, status } = useWeatherData(county);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="title">{countyName}</span>
      </div>
      {status === "loading" && (
        <div className="state-box" style={{ padding: "1.5rem 0" }}>
          <div className="spinner" />
        </div>
      )}
      {status === "error" && <p style={{ fontSize: "0.85rem", color: "rgba(var(--paper-rgb),0.6)" }}>Couldn&apos;t load data.</p>}
      {status === "success" && data && (
        <RiskGauge score={computeRiskScore(splitDaily(data).trailing).score} level={computeRiskScore(splitDaily(data).trailing).level} />
      )}
    </div>
  );
}
