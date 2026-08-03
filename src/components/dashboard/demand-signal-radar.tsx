"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

type DemandSignalRadarDatum = {
  metric: string;
  value: number;
};

type DemandSignalRadarProps = {
  data: DemandSignalRadarDatum[];
};

export function DemandSignalRadar({ data }: DemandSignalRadarProps) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 12, right: 16, bottom: 12, left: 16 }}>
          <PolarGrid stroke="rgba(139,26,26,0.16)" />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: "#57534e" }} />
          <PolarRadiusAxis
            domain={[0, 100]}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#78716c" }}
          />
          {/* Keep the radar on a normalized 0-100 scale so mixed student KPIs
              can be read together without pretending they share one unit. */}
          <Radar
            name="Signal"
            dataKey="value"
            stroke="#8B1A1A"
            fill="rgba(139,26,26,0.22)"
            fillOpacity={1}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
