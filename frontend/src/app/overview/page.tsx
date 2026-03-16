"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ServerCard } from "@/components/overview/ServerCard";
import { Spinner } from "@/components/ui/Spinner";
import { Server } from "lucide-react";
import type { Server as ServerType, ServerSummary } from "@/lib/types";

export default function OverviewPage() {
  const [summaries, setSummaries] = useState<ServerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/servers", { credentials: "include" });
        if (res.status === 401) { window.location.href = "/login"; return; }
        const servers: ServerType[] = await res.json();

        const now = Date.now();
        const withSummaries = await Promise.all(
          servers.map(async (server) => {
            const isOnline = server.lastSeenAt
              ? now - new Date(server.lastSeenAt).getTime() < 60_000
              : false;
            const status = isOnline ? "online" : "offline";

            let latestMetrics: ServerSummary["latestMetrics"] = undefined;
            if (isOnline) {
              try {
                const lr = await fetch(`/api/v1/servers/${server.id}/latest`, { credentials: "include" });
                if (lr.ok) latestMetrics = await lr.json();
              } catch {}
            }

            const alertsRes = await fetch(`/api/v1/alerts?server_id=${server.id}`, { credentials: "include" });
            let activeAlerts = 0;
            if (alertsRes.ok) {
              const alerts = await alertsRes.json();
              activeAlerts = alerts.filter((a: { active: boolean }) => a.active).length;
            }

            return { server: { ...server, status }, latestMetrics, activeAlerts } satisfies ServerSummary;
          })
        );
        setSummaries(withSummaries);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Overview</h1>
            <p className="text-gray-500 text-sm mt-1">
              {loading ? "Loading..." : `${summaries.length} servers monitored`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Live
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner />
          </div>
        ) : summaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-purple-900/30 rounded-xl bg-[#111111]">
            <Server className="w-10 h-10 text-purple-900 mb-3" />
            <p className="text-white font-medium">No servers yet</p>
            <p className="text-gray-500 text-sm mt-1">Deploy a Sudosyu agent to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {summaries.map((s) => (
              <ServerCard key={s.server.id} data={s} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
