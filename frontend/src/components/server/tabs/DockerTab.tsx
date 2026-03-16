"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatBytes } from "@/lib/utils";
import type { Container, DockerDF } from "@/lib/types";

const statusVariant: Record<string, "green" | "red" | "yellow" | "gray"> = {
  running: "green",
  exited: "red",
  restarting: "yellow",
  paused: "gray",
  dead: "red",
  created: "gray",
};

export function DockerTab({ serverId }: { serverId: string }) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [dockerDF, setDockerDF] = useState<DockerDF | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [cRes, dfRes] = await Promise.all([
          fetch(`/api/v1/servers/${serverId}/containers`, { credentials: "include" }),
          fetch(`/api/v1/servers/${serverId}/docker-df`, { credentials: "include" }),
        ]);
        if (cRes.ok) setContainers(await cRes.json());
        if (dfRes.ok) setDockerDF(await dfRes.json());
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [serverId]);

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {/* Containers table */}
      <Card>
        <div className="p-4 border-b border-purple-900/20">
          <h3 className="text-white font-medium text-sm">
            Containers
            <span className="ml-2 text-gray-500 font-normal">
              {containers.filter((c) => c.status === "running").length} running / {containers.length} total
            </span>
          </h3>
        </div>
        {containers.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-10">No container data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-900/10">
                  {["Name", "Image", "Status", "Uptime", "Restarts", "CPU%", "MEM"].map((h) => (
                    <th key={h} className="text-left text-gray-500 font-medium px-4 py-3 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} className="border-b border-purple-900/10 hover:bg-purple-900/5 transition-colors">
                    <td className="px-4 py-3 text-white font-mono text-xs">{c.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.image}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[c.status] ?? "gray"}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.uptime ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.restartCount}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={(c.cpu ?? 0) > 80 ? "text-red-400" : "text-gray-300"}>
                        {c.cpu != null ? `${c.cpu.toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {c.memMB != null ? `${c.memMB.toFixed(0)} MB` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Docker system df */}
      {dockerDF && (
        <div>
          <h3 className="text-white font-medium text-sm mb-3">Docker Storage</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Images", size: dockerDF.imagesSize, reclaimable: dockerDF.imagesReclaimable },
              { label: "Containers", size: dockerDF.containersSize, reclaimable: 0 },
              { label: "Volumes", size: dockerDF.volumesSize, reclaimable: dockerDF.volumesReclaimable },
              { label: "Build Cache", size: dockerDF.buildCacheSize, reclaimable: dockerDF.buildCacheReclaimable },
            ].map((item) => (
              <Card key={item.label} className="p-4">
                <p className="text-gray-500 text-xs mb-1">{item.label}</p>
                <p className="text-white font-bold text-lg font-mono">{formatBytes(item.size)}</p>
                {item.reclaimable > 0 && (
                  <p className="text-purple-400/60 text-xs mt-0.5">{formatBytes(item.reclaimable)} reclaimable</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
