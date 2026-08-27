const LEVEL_COLOR = {
  Low: "var(--risk-low)",
  Moderate: "var(--risk-moderate)",
  High: "var(--risk-high)",
};

const LEVEL_BG = {
  Low: "rgba(106, 156, 86, 0.16)",
  Moderate: "rgba(217, 164, 65, 0.16)",
  High: "rgba(193, 91, 58, 0.16)",
};

// Draws a semicircular gauge from 0-100 using an SVG arc, with a marker
// dot at the current score position.
export default function RiskGauge({ score, level }) {
  const angle = (score / 100) * 180; // degrees along the semicircle
  const radians = ((180 - angle) * Math.PI) / 180;
  const cx = 100;
  const cy = 100;
  const r = 78;
  const markerX = cx - r * Math.cos(radians);
  const markerY = cy - r * Math.sin(radians);

  // Arc path for the filled portion, from left (0) to the score angle
  const largeArc = angle > 180 ? 1 : 0;
  const startX = cx - r;
  const startY = cy;
  const endX = cx - r * Math.cos(radians);
  const endY = cy - r * Math.sin(radians);

  return (
    <div className="gauge-card">
      <svg viewBox="0 0 200 118" style={{ width: "170px", height: "100px" }} role="img" aria-label={`Risk score ${score} out of 100, ${level}`}>
        <path
          d={`M 20 100 A ${r} ${r} 0 0 1 180 100`}
          fill="none"
          stroke="rgba(245,239,226,0.12)"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
          fill="none"
          stroke={LEVEL_COLOR[level]}
          strokeWidth="13"
          strokeLinecap="round"
        />
        <circle cx={markerX} cy={markerY} r="6.5" fill={LEVEL_COLOR[level]} />
      </svg>
      <p className="gauge-value">{score}</p>
      <p className="gauge-label">RISK INDEX</p>
      <span
        className="risk-pill"
        style={{ color: LEVEL_COLOR[level], background: LEVEL_BG[level] }}
      >
        {level}
      </span>
    </div>
  );
}
