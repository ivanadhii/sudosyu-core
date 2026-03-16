"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { MetricChart } from "@/components/charts/MetricChart";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { MetricPoint } from "@/lib/types";

const timeRanges = [
  { label: "1h", seconds: 3600, resolution: "raw" },
  { label: "6h", seconds: 21600, resolution: "1m" },
  { label: "24h", seconds: 86400, resolution: "5m" },
  { label: "7d", seconds: 604800, resolution: "1h" },
  { label: "30d", seconds: 2592000, resolution: "1h" },
] as const;

type TimeRangeLabel = (typeof timeRanges)[number]["label"];

interface LatestSummary {
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  containersRunning: number;
}

interface ChartData {
  cpu: MetricPoint[];
  ram: MetricPoint[];
  diskIO: MetricPoint[];
  netIn: MetricPoint[];
}

export function SystemTab({ serverId }: { serverId: string }) {
  const [range, setRange] = useState<TimeRangeLabel>("1h");
  const [latest, setLatest] = useState<LatestSummary | null>(null);
  const [charts, setCharts] = useState<ChartData>({ cpu: [], ram: [], diskIO: [], netIn: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const selected = timeRanges.find((r) => r.label === range)!;
    const end = new Date();
    const start = new Date(end.getTime() - selected.seconds * 1000);
    const res = selected.resolution;

    const params = (type: string, name: string) =>
      `?type=${type}&name=${name}&resolution=${res}&start=${start.toISOString()}&end=${end.toISOString()}`;

    const [latestRes, cpuRes, ramRes, diskIORes, netInRes] = await Promise.all([
      fetch(`/api/v1/servers/${serverId}/latest`, { credentials: "include" }),
      fetch(`/api/v1/servers/${serverId}/metrics${params("cpu", "total")}`, { credentials: "include" }),
      fetch(`/api/v1/servers/${serverId}/metrics${params("ram", "used_percent")}`, { credentials: "include" }),
      fetch(`/api/v1/servers/${serverId}/metrics${params("disk_io", "read_bytes_per_sec")}`, { credentials: "include" }),
      fetch(`/api/v1/servers/${serverId}/metrics${params("network", "bytes_recv_per_sec")}`, { credentials: "include" }),
    ]);

    if (latestRes.ok) {
      const l = await latestRes.json();
      setLatest({
        cpuPercent: l.cpuPercent ?? null,
        ramPercent: l.ramPercent ?? null,
        diskPercent: l.diskPercent ?? null,
        containersRunning: l.containersRunning ?? 0,
      });
    }

    const parsePoints = async (r: Response): Promise<MetricPoint[]> => {
      if (!r.ok) return [];
      const data = await r.json();
      return data ?? [];
    };

    setCharts({
      cpu: await parsePoints(cpuRes),
      ram: await parsePoints(ramRes),
      diskIO: await parsePoints(diskIORes),
      netIn: await parsePoints(netInRes),
    });

    setLoading(false);
  }, [serverId, range]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Time range */}
      <div className="flex items-center gap-1">
        {timeRanges.map((r) => (
          <button
            key={r.label}
            onClick={() => setRange(r.label)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              range === r.label
                ? "bg-purple-700/20 text-purple-400 border border-purple-700/30"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="CPU"
              value={latest?.cpuPercent != null ? `${latest.cpuPercent.toFixed(1)}%` : "—"}
              percent={latest?.cpuPercent ?? undefined}
            />
            <StatCard
              label="RAM"
              value={latest?.ramPercent != null ? `${latest.ramPercent.toFixed(1)}%` : "—"}
              percent={latest?.ramPercent ?? undefined}
            />
            <StatCard
              label="Disk"
              value={latest?.diskPercent != null ? `${latest.diskPercent.toFixed(1)}%` : "—"}
              percent={latest?.diskPercent ?? undefined}
            />
            <StatCard
              label="Containers"
              value={latest?.containersRunning ?? "—"}
              sub="running"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MetricChart title="CPU Usage" unit="%" data={charts.cpu} color="#A855F7" />
            <MetricChart title="RAM Usage" unit="%" data={charts.ram} color="#7C3AED" />
            <MetricChart title="Disk I/O Read" unit=" B/s" data={charts.diskIO} color="#A855F7" />
            <MetricChart title="Network In" unit=" B/s" data={charts.netIn} color="#7C3AED" />
          </div>
        </>
      )}
    </div>
  );
}
