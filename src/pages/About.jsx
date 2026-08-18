const FACTORS = [
  {
    icon: "💧",
    bg: "rgba(74,122,156,0.18)",
    title: "Rainfall",
    desc: "Sustained rain creates standing water where mosquitoes breed.",
  },
  {
    icon: "🌫️",
    bg: "rgba(127,166,106,0.18)",
    title: "Humidity",
    desc: "Relative humidity above roughly 60% extends adult mosquito lifespan.",
  },
  {
    icon: "🌡️",
    bg: "rgba(193,91,58,0.18)",
    title: "Temperature",
    desc: "20-30°C speeds up parasite development inside the mosquito.",
  },
];

export default function About() {
  return (
    <div>
      <div className="dash-title" style={{ marginBottom: "1.25rem" }}>
        <div className="icon-badge">ⓘ</div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: 0 }}>
            How risk is calculated
          </h2>
        </div>
      </div>

      <p style={{ color: "rgba(245,239,226,0.65)", lineHeight: 1.7, maxWidth: "60ch" }}>
        Risk is estimated from rainfall, humidity and temperature over the trailing
        14 days, weighted against conditions known to favor Anopheles mosquito
        breeding and survival. Each factor contributes to a 0-100 score, split
        roughly 40% rainfall, 30% humidity, 30% temperature.
      </p>

      <div style={{ marginTop: "1.5rem" }}>
        {FACTORS.map((f) => (
          <div className="factor-row" key={f.title}>
            <div className="icon" style={{ background: f.bg }}>
              {f.icon}
            </div>
            <div>
              <p className="factor-title">{f.title}</p>
              <p className="factor-desc">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="warning-box">
        ⚠️ This is an educational estimate, not a medical diagnosis. If you have
        symptoms or concerns, consult a health facility.
      </div>
    </div>
  );
}
