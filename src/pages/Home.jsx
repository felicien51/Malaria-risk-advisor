import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { COUNTIES } from "../data/counties";
import { useRecentCounties } from "../hooks/useRecentCounties";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { recent } = useRecentCounties();
  const { t } = useLanguage();

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
        <p className="hero-eyebrow">{t("heroEyebrow")}</p>
        <h1>{t("heroTitle")}</h1>
        <p>{t("heroBody")}</p>
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("searchPlaceholder")}
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
        <p className="county-count">{t("noMatch", { query })}</p>
      )}
      {filtered.length > 0 && (
        <p className="county-count">
          {t("countyCount", { count: filtered.length, total: COUNTIES.length })}
        </p>
      )}
    </div>
  );
}
