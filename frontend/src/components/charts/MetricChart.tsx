"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import type { MetricPoint } from "@/lib/types";

interface MetricChartProps {
  title: string;
  unit: string;
  data: MetricPoint[];
  color?: string;
}

function formatTime(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MetricChart({ title, unit, data, color = "#A855F7" }: MetricChartProps) {
  const chartData = data.map((d) => ({ time: formatTime(d.time), value: d.value }));

  return (
    <Card className="p-4">
      <p className="text-gray-400 text-xs font-medium mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fill: "#4B5563", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#4B5563", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Math.round(v)}${unit.trim()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111111",
              border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#ffffff",
            }}
            formatter={(v: number) => [`${v.toFixed(1)}${unit}`, title]}
            labelStyle={{ color: "#9CA3AF" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${title})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
