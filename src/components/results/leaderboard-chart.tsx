"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency } from "@/lib/formatters";

type LeaderboardChartDatum = {
  teamName: string;
  totalRevenue: number;
};

type LeaderboardChartProps = {
  data: LeaderboardChartDatum[];
};

function getTooltipNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (Array.isArray(value)) {
    return getTooltipNumber(value[0]);
  }

  return null;
}

export function LeaderboardChart({ data }: LeaderboardChartProps) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 8,
            right: 16,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="teamName"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatCompactCurrency(value)}
          />
          <Tooltip
            formatter={(value) => {
              const revenue = getTooltipNumber(value);
              return [formatCompactCurrency(revenue), "Revenue"];
            }}
          />
          <Bar dataKey="totalRevenue" fill="#8B1A1A" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
