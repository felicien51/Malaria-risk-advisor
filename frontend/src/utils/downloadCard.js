const LEVEL_COLOR = { Low: "#6a9c56", Moderate: "#d9a441", High: "#c15b3a" };

// Draws a simple shareable summary card to a canvas and triggers a PNG
// download. No extra library — just the native Canvas API.
export function downloadRiskCard({ countyName, score, level, rainfall, humidity, temp }) {
  const canvas = document.createElement("canvas");
  const W = 800, H = 500;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0d1f1a";
  ctx.fillRect(0, 0, W, H);

  // Decorative accent circle
  ctx.beginPath();
  ctx.fillStyle = "rgba(219,166,73,0.08)";
  ctx.arc(W - 60, 60, 180, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrow
  ctx.fillStyle = "#dba649";
  ctx.font = "600 16px Consolas, monospace";
  ctx.fillText("MALARIA RISK ADVISOR", 48, 64);

  // County name
  ctx.fillStyle = "#f5efe2";
  ctx.font = "500 40px Georgia, serif";
  ctx.fillText(`${countyName} County`, 48, 120);

  // Score
  ctx.fillStyle = LEVEL_COLOR[level] || "#f5efe2";
  ctx.font = "600 96px Georgia, serif";
  ctx.fillText(String(score), 48, 240);

  ctx.font = "500 28px Arial, sans-serif";
  ctx.fillText(level + " risk", 48, 280);

  // Stats row
  const stats = [
    ["Rainfall (14d)", rainfall],
    ["Avg humidity", humidity],
    ["Avg temp", temp],
  ];
  let sx = 48;
  stats.forEach(([label, value]) => {
    ctx.fillStyle = "rgba(245,239,226,0.55)";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(label.toUpperCase(), sx, 340);
    ctx.fillStyle = "#f5efe2";
    ctx.font = "600 22px Arial, sans-serif";
    ctx.fillText(String(value), sx, 370);
    sx += 260;
  });

  // Footer
  ctx.fillStyle = "rgba(245,239,226,0.45)";
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText(
    "Educational estimate, not a medical diagnosis · Data from Open-Meteo",
    48,
    450
  );
  ctx.fillText(new Date().toLocaleDateString(), 48, 470);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${countyName.toLowerCase()}-malaria-risk.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}
