"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";

interface DomainChartProps {
  domainCounts: Record<string, number>;
}

const COLORS = [
  "oklch(0.809 0.105 251.813)", // chart-1
  "oklch(0.623 0.214 259.815)", // chart-2
  "oklch(0.546 0.245 262.881)", // chart-3
  "oklch(0.488 0.243 264.376)", // chart-4
  "oklch(0.424 0.199 265.638)", // chart-5
  "oklch(0.72 0.15 200)",
  "oklch(0.65 0.18 150)",
  "oklch(0.58 0.20 100)",
  "oklch(0.75 0.10 50)",
  "oklch(0.68 0.12 300)",
  "oklch(0.60 0.16 330)",
  "oklch(0.70 0.14 30)",
  "oklch(0.55 0.22 220)",
  "oklch(0.78 0.08 170)",
  "oklch(0.63 0.19 280)",
];

export function DomainChart({ domainCounts }: DomainChartProps) {
  const data = useMemo(() => {
    return Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
  }, [domainCounts]);

  const summaryText = useMemo(() => {
    if (data.length === 0) return "No domain data available.";
    const top3 = data.slice(0, 3);
    const parts = top3.map((d) => `${d.domain} (${d.count})`).join(", ");
    return `Bar chart showing idea counts per domain. ${data.length} domains total. Top domains: ${parts}.`;
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No domain data available yet.
      </p>
    );
  }

  const chartHeight = Math.max(250, data.length * 36);

  return (
    <div className="mt-4 space-y-2">
      <div
        role="img"
        aria-label={summaryText}
        className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
          >
            <XAxis type="number" allowDecimals={false} tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="domain"
              width={140}
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                border: "1px solid oklch(1 0 0 / 10%)",
                borderRadius: "8px",
                color: "oklch(0.985 0 0)",
                fontSize: "13px",
              }}
              formatter={(value) => [`${value} ideas`, "Count"]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fill: "oklch(0.708 0 0)", fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Screen-reader text alternative */}
      <div className="sr-only" role="status">
        <p>{summaryText}</p>
        <ul>
          {data.map((d) => (
            <li key={d.domain}>
              {d.domain}: {d.count} {d.count === 1 ? "idea" : "ideas"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
