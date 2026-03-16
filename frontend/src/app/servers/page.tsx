"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";

type ServerSummary = {
  id: string;
  name: string;
  tags: string[];
  lastSeenAt: string | null;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
};

function pct(v: number | null) {
  if (v == null) return <span className="text-gray-600">—</span>;
  const color = v >= 90 ? "text-red-400" : v >= 70 ? "text-yellow-400" : "text-gray-300";
  return <span className={color}>{v.toFixed(1)}%</span>;
}

export default function ServersPage() {
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/servers/summaries", { credentials: "include" });
        if (res.status === 401) { window.location.href = "/login"; return; }
        setServers(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, []);

  function serverStatus(s: ServerSummary): "online" | "offline" {
    if (!s.lastSeenAt) return "offline";
    return Date.now() - new Date(s.lastSeenAt).getTime() < 60_000 ? "online" : "offline";
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Servers</h1>
          <p className="text-gray-500 text-sm mt-1">All registered servers</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Spinner /></div>
        ) : (
          <div className="bg-[#111111] border border-purple-900/30 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-900/20">
                  {["Name", "Status", "CPU", "RAM", "Disk", "Tags", "Last seen"].map((h) => (
                    <th key={h} className="text-left text-gray-500 font-medium px-5 py-3 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {servers.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600">No servers registered.</td></tr>
                ) : servers.map((server) => (
                  <tr key={server.id} className="border-b border-purple-900/10 hover:bg-purple-900/5 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/servers/${server.id}`} className="text-white hover:text-purple-400 transition-colors font-medium">
                        {server.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={serverStatus(server) === "online" ? "green" : "red"}>{serverStatus(server)}</Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{pct(server.cpuPercent)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{pct(server.ramPercent)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{pct(server.diskPercent)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {server.tags.map((tag) => <Badge key={tag} variant="purple">{tag}</Badge>)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {server.lastSeenAt ? timeAgo(server.lastSeenAt) : "never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
