"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
export default function Charts({
  data,
  trend = false,
  metric = "Stock units",
}: {
  data: { name: string; value: number }[];
  trend?: boolean;
  metric?: string;
}) {
  if (!data.length)
    return <div className="chart-empty">No records in this period.</div>;
  const content = (
    <>
      <CartesianGrid vertical={false} stroke="var(--line)" />
      <XAxis
        dataKey="name"
        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        width={40}
      />
      <Tooltip
        contentStyle={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          color: "var(--foreground)",
        }}
        cursor={{ fill: "#38bdf810" }}
      />
      {trend ? (
        <Area
          type="monotone"
          dataKey="value"
          name="Orders"
          stroke="#38bdf8"
          fill="#38bdf820"
          strokeWidth={2}
        />
      ) : (
        <Bar
          dataKey="value"
          name={metric}
          fill="#38bdf8"
          radius={[5, 5, 0, 0]}
          maxBarSize={42}
        />
      )}
    </>
  );
  return (
    <div
      className="chart"
      role="img"
      aria-label={data.map((x) => `${x.name}: ${x.value}`).join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%">
        {trend ? (
          <AreaChart data={data}>{content}</AreaChart>
        ) : (
          <BarChart data={data}>{content}</BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
