import { useLanguage } from "../context/LanguageContext.jsx";

const FACTOR_KEYS = [
  { icon: "💧", bg: "rgba(74,122,156,0.18)", titleKey: "factorRainfallTitle", descKey: "factorRainfallDesc" },
  { icon: "🌫️", bg: "rgba(127,166,106,0.18)", titleKey: "factorHumidityTitle", descKey: "factorHumidityDesc" },
  { icon: "🌡️", bg: "rgba(193,91,58,0.18)", titleKey: "factorTempTitle", descKey: "factorTempDesc" },
];

export default function About() {
  const { t } = useLanguage();

  return (
    <div>
      <div className="dash-title" style={{ marginBottom: "1.25rem" }}>
        <div className="icon-badge">ⓘ</div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: 0 }}>
            {t("aboutTitle")}
          </h2>
        </div>
      </div>

      <p style={{ color: "rgba(var(--paper-rgb),0.65)", lineHeight: 1.7, maxWidth: "60ch" }}>
        {t("aboutBody")}
      </p>

      <div style={{ marginTop: "1.5rem" }}>
        {FACTOR_KEYS.map((f) => (
          <div className="factor-row" key={f.titleKey}>
            <div className="icon" style={{ background: f.bg }}>
              {f.icon}
            </div>
            <div>
              <p className="factor-title">{t(f.titleKey)}</p>
              <p className="factor-desc">{t(f.descKey)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="warning-box">⚠️ {t("warningBox")}</div>
    </div>
  );
}
