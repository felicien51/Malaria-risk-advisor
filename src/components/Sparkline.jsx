// Minimal inline SVG sparkline — no charting library needed for this small use case.
export default function Sparkline({ points, width = 140, height = 32 }) {
  if (points.length < 2) {
    return <span style={{ fontSize: "0.72rem", color: "rgba(var(--paper-rgb),0.4)" }}>Not enough data yet this session</span>;
  }

  const max = Math.max(...points.map((p) => p.score), 100);
  const min = 0;
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.score - min) / (max - min)) * height;
    return [x, y];
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: `${height}px` }} role="img" aria-label="Risk score trend this session">
      <path d={path} fill="none" stroke="var(--ochre-500)" strokeWidth="2" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="3" fill="var(--ochre-500)" />
    </svg>
  );
}
