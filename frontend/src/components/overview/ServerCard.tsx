import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { timeAgo } from "@/lib/utils";
import { Bell, Box } from "lucide-react";
import type { ServerSummary } from "@/lib/types";

function UsageBar({ value, label }: { value: number; label: string }) {
  const color = value > 90 ? "bg-red-500" : value > 70 ? "bg-yellow-500" : "bg-purple-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className={value > 90 ? "text-red-400" : value > 70 ? "text-yellow-400" : "text-purple-400"}>
          {value}%
        </span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export function ServerCard({ data }: { data: ServerSummary }) {
  const { server, latestMetrics, activeAlerts } = data;
  const isOnline = server.status === "online";

  return (
    <Link href={`/servers/${server.id}`}>
      <Card className="p-5 hover:border-purple-700/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)] transition-all cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-sm group-hover:text-purple-300 transition-colors">
              {server.name}
            </h3>
            <p className="text-gray-600 text-xs mt-0.5">{timeAgo(server.lastSeenAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            {activeAlerts > 0 && (
              <div className="flex items-center gap-1 text-yellow-400 text-xs">
                <Bell className="w-3 h-3" />
                {activeAlerts}
              </div>
            )}
            <Badge variant={isOnline ? "green" : "red"}>
              {isOnline ? "online" : "offline"}
            </Badge>
          </div>
        </div>

        {/* Tags */}
        {server.tags.length > 0 && (
          <div className="flex gap-1 mb-4 flex-wrap">
            {server.tags.map((tag) => (
              <Badge key={tag} variant="purple">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Metrics */}
        {latestMetrics && isOnline ? (
          <div className="space-y-2.5">
            <UsageBar value={latestMetrics.cpuPercent} label="CPU" />
            <UsageBar value={latestMetrics.ramPercent} label="RAM" />
            <UsageBar value={latestMetrics.diskPercent} label="Disk" />
            <div className="flex items-center gap-1.5 pt-1 text-xs text-gray-500">
              <Box className="w-3 h-3" />
              <span>{latestMetrics.containersRunning} containers running</span>
            </div>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center">
            <p className="text-gray-700 text-xs">No data</p>
          </div>
        )}
      </Card>
    </Link>
  );
}
