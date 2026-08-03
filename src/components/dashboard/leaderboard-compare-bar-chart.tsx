"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency } from "@/lib/formatters";

type LeaderboardCompareBarChartDatum = {
  teamName: string;
  totalRevenue: number;
  netProfit: number;
};

type LeaderboardCompareBarChartProps = {
  data: LeaderboardCompareBarChartDatum[];
};

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function LeaderboardCompareBarChart({
  data,
}: LeaderboardCompareBarChartProps) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.24)" />
          <XAxis
            dataKey="teamName"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#57534e" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#57534e" }}
            tickFormatter={(value) => formatCompactCurrency(coerceNumber(value))}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCompactCurrency(coerceNumber(value)),
              String(name),
            ]}
          />
          <Legend />
          {/* Teachers need topline and profitability side by side during class
              review, not buried in separate tables or exported files. */}
          <Bar
            dataKey="totalRevenue"
            name="Revenue"
            fill="#8B1A1A"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="netProfit"
            name="Profit"
            fill="#C9A84C"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
