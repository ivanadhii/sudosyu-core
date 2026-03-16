"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { Alert } from "@/lib/types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/v1/alerts", { credentials: "include" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) setAlerts(await res.json());
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, []);

  const active = alerts.filter((a) => a.active);

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-gray-500 text-sm mt-1">{loading ? "Loading..." : `${active.length} active alert rules`}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Spinner /></div>
        ) : (
          <Card>
            {alerts.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-10">No alert rules configured.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-purple-900/20">
                    {["Server", "Metric", "Condition", "Duration", "Status"].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium px-4 py-3 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.id} className="border-b border-purple-900/10 hover:bg-purple-900/5">
                      <td className="px-4 py-3 text-white font-mono text-xs">{alert.serverId}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{alert.metric}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{alert.condition === "gt" ? ">" : "<"} {alert.threshold}%</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{alert.durationSeconds}s</td>
                      <td className="px-4 py-3">
                        <Badge variant={alert.active ? "green" : "gray"}>{alert.active ? "active" : "inactive"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
