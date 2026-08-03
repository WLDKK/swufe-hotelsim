"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatPercent } from "@/lib/formatters";

type PerformanceHistoryPoint = {
  roundNumber: number;
  totalRevenue: number;
  netProfit: number;
  occupancyRate: number;
};

type PerformanceHistoryChartProps = {
  data: PerformanceHistoryPoint[];
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

export function PerformanceHistoryChart({
  data,
}: PerformanceHistoryChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
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
            dataKey="roundNumber"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `R${value}`}
          />
          <YAxis
            yAxisId="money"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatCompactCurrency(value)}
          />
          <YAxis
            yAxisId="percent"
            orientation="right"
            domain={[0, 1]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatPercent(value)}
          />
          <Tooltip
            formatter={(value, name) => {
              const numericValue = getTooltipNumber(value);
              if (name === "occupancyRate") {
                return [formatPercent(numericValue), "Occupancy"];
              }

              return [
                formatCompactCurrency(numericValue),
                name === "totalRevenue" ? "Revenue" : "Profit",
              ];
            }}
            labelFormatter={(value) => `Round ${value}`}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="totalRevenue"
            stroke="#8B1A1A"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="netProfit"
            stroke="#C9A84C"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="percent"
            type="monotone"
            dataKey="occupancyRate"
            stroke="#1B3A5C"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
