"use client";

import { use, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SystemTab } from "@/components/server/tabs/SystemTab";
import { DockerTab } from "@/components/server/tabs/DockerTab";
import { AlertsTab } from "@/components/server/tabs/AlertsTab";
import { ExportTab } from "@/components/server/tabs/ExportTab";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { Server } from "@/lib/types";

const tabs = ["System", "Docker", "Alerts", "Export"] as const;
type Tab = (typeof tabs)[number];

export default function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serverId } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("System");
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/servers/${serverId}`, { credentials: "include" });
        if (res.status === 401) { window.location.href = "/login"; return; }
        if (res.ok) setServer(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [serverId]);

  function serverStatus(): "online" | "offline" {
    if (!server?.lastSeenAt) return "offline";
    return Date.now() - new Date(server.lastSeenAt).getTime() < 60_000 ? "online" : "offline";
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-screen"><Spinner /></div>
    </AppLayout>
  );

  if (!server) return (
    <AppLayout>
      <div className="p-8 text-gray-500">Server not found.</div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{server.name}</h1>
          <Badge variant={serverStatus() === "online" ? "green" : "red"}>{serverStatus()}</Badge>
          {server.tags.map((tag) => <Badge key={tag} variant="purple">{tag}</Badge>)}
        </div>

        <div className="flex gap-1 mb-6 border-b border-purple-900/20">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
                activeTab === tab
                  ? "text-purple-400 border-purple-500"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "System" && <SystemTab serverId={serverId} />}
        {activeTab === "Docker" && <DockerTab serverId={serverId} />}
        {activeTab === "Alerts" && <AlertsTab serverId={serverId} />}
        {activeTab === "Export" && <ExportTab serverId={serverId} />}
      </div>
    </AppLayout>
  );
}
