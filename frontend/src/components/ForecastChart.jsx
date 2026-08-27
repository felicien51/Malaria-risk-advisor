import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Combined bar (rainfall) + line (temperature) chart for the forecast window.
export default function ForecastChart({ rows }) {
  const chartData = rows.map((row) => ({
    day: new Date(row.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
    rainfall: row.precipitation ?? null,
    temperature: row.tempMean != null ? Math.round(row.tempMean * 10) / 10 : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="rgba(var(--paper-rgb),0.06)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: "rgba(var(--paper-rgb),0.45)", fontSize: 11 }}
          axisLine={{ stroke: "rgba(var(--paper-rgb),0.1)" }}
          tickLine={false}
          interval={Math.ceil(chartData.length / 8)}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "rgba(var(--paper-rgb),0.45)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <YAxis yAxisId="right" orientation="right" hide />
        <Tooltip
          contentStyle={{
            background: "var(--ink-900)",
            border: "1px solid rgba(var(--paper-rgb),0.15)",
            borderRadius: 10,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--paper)" }}
        />
        <Bar
          yAxisId="left"
          dataKey="rainfall"
          name="Rainfall (mm)"
          fill="#4a7a9c"
          radius={[3, 3, 0, 0]}
          barSize={12}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="temperature"
          name="Temp (°C)"
          stroke="#c15b3a"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
