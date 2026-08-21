import { useNavigate } from "react-router-dom";
import { COUNTIES } from "../data/counties";
import { useAllCountiesRisk } from "../hooks/useAllCountiesRisk";

// Kenya's approximate bounding box, used to project lat/lon onto the SVG
// viewBox. This is a coordinate scatter, not real county border shapes —
// there's no offline GeoJSON for Kenya's counties in this environment.
const LAT_MIN = -4.85, LAT_MAX = 5.05;
const LON_MIN = 33.85, LON_MAX = 41.95;
const W = 640, H = 620;
const PAD = 40;

function project(lat, lon) {
  const x = PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (W - PAD * 2);
  // lat increases upward, SVG y increases downward
  const y = PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (H - PAD * 2);
  return [x, y];
}

const LEVEL_COLOR = { Low: "#6a9c56", Moderate: "#d9a441", High: "#c15b3a" };

export default function MapView() {
  const navigate = useNavigate();
  const { results, loadedCount, total } = useAllCountiesRisk();
  const done = loadedCount >= total;

  return (
    <div>
      <div className="dash-title" style={{ marginBottom: "0.5rem" }}>
        <div className="icon-badge">🗺️</div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: 0 }}>
            Kenya risk map
          </h2>
          <p className="subtitle">
            {done ? `All ${total} counties loaded` : `Loading… ${loadedCount}/${total} counties`}
          </p>
        </div>
      </div>

      <p style={{ fontSize: "0.78rem", color: "rgba(var(--paper-rgb),0.45)", marginBottom: "1rem" }}>
        Approximate positions by coordinate, not official county boundaries.
      </p>

      <div className="panel" style={{ display: "flex", justifyContent: "center" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", maxWidth: "560px", height: "auto" }}
          role="img"
          aria-label="Map of Kenya with counties colored by current malaria risk level"
        >
          {COUNTIES.map((county) => {
            const [x, y] = project(county.lat, county.lon);
            const result = results[county.name];
            const color =
              result && result !== "error" ? LEVEL_COLOR[result.level] : "rgba(245,239,226,0.15)";
            return (
              <g key={county.name}>
                <circle
                  cx={x}
                  cy={y}
                  r={result && result !== "error" ? 9 : 5}
                  fill={color}
                  stroke="rgba(13,31,26,0.6)"
                  strokeWidth="1"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/county/${encodeURIComponent(county.name)}`)}
                >
                  <title>
                    {county.name}
                    {result && result !== "error" ? ` — ${result.level} (${result.score})` : " — loading"}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="legend" style={{ justifyContent: "center", marginTop: "0.75rem" }}>
        <span>
          <span className="dot" style={{ background: LEVEL_COLOR.Low }} /> Low
        </span>
        <span>
          <span className="dot" style={{ background: LEVEL_COLOR.Moderate }} /> Moderate
        </span>
        <span>
          <span className="dot" style={{ background: LEVEL_COLOR.High }} /> High
        </span>
        <span>
          <span className="dot" style={{ background: "rgba(245,239,226,0.15)" }} /> Loading
        </span>
      </div>
    </div>
  );
}
