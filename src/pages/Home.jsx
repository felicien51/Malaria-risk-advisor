import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { COUNTIES } from "../data/counties";
import { useRecentCounties } from "../hooks/useRecentCounties";

export default function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { recent } = useRecentCounties();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTIES;
    return COUNTIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div>
      <section className="hero">
        <p className="hero-eyebrow">Weather-driven public health tool</p>
        <h1>Malaria risk, read from the sky.</h1>
        <p>
          Rainfall, humidity and temperature drive mosquito breeding conditions.
          Pick a county to see today&apos;s estimated risk and a 16-day outlook.
        </p>
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search a county or region"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search counties"
          />
        </div>
      </section>

      {recent.length > 0 && (
        <div className="recent-chips">
          {recent.map((name) => (
            <button
              key={name}
              className="recent-chip"
              onClick={() => navigate(`/county/${encodeURIComponent(name)}`)}
            >
              ↻ {name}
            </button>
          ))}
        </div>
      )}

      <div className="county-grid">
        {filtered.map((county) => (
          <button
            key={county.name}
            className="county-card"
            onClick={() => navigate(`/county/${encodeURIComponent(county.name)}`)}
          >
            <span className="name">{county.name}</span>
            <span className="region">{county.region}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="county-count">No counties match &quot;{query}&quot;</p>
      )}
      {filtered.length > 0 && (
        <p className="county-count">
          {filtered.length} of {COUNTIES.length} counties
        </p>
      )}
    </div>
  );
}
