export type Role = "superadmin" | "coordinator" | "watcher";

export type Permission =
  | "view_metrics"
  | "view_docker"
  | "manage_alerts"
  | "export_data"
  | "manage_watchers";

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface ServerAccess {
  serverId: string;
  serverName: string;
  permissions: Permission[];
  grantedBy: string;
}

export interface Server {
  id: string;
  name: string;
  tags: string[];
  status: "online" | "offline";
  lastSeenAt: string;
  createdAt: string;
}

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    totalPercent: number;
    perCore: number[];
    loadAvg1m: number;
    loadAvg5m: number;
    loadAvg15m: number;
  };
  ram: {
    totalGB: number;
    usedGB: number;
    availableGB: number;
    usedPercent: number;
    swapTotalGB: number;
    swapUsedGB: number;
  };
  disks: {
    mountPoint: string;
    totalGB: number;
    usedGB: number;
    freeGB: number;
    usedPercent: number;
  }[];
  diskIO: {
    device: string;
    readBytesPerSec: number;
    writeBytesPerSec: number;
    readIOPS: number;
    writeIOPS: number;
    utilPercent: number;
  }[];
  network: {
    interface: string;
    bytesSentPerSec: number;
    bytesRecvPerSec: number;
    packetsSentPerSec: number;
    packetsRecvPerSec: number;
  }[];
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: "running" | "exited" | "restarting" | "paused" | "dead" | "created";
  uptime: string;
  restartCount: number;
  ports: string[];
  createdAt: string;
  cpu?: number;
  memMB?: number;
  memPercent?: number;
  netIn?: number;
  netOut?: number;
  blockRead?: number;
  blockWrite?: number;
}

export interface DockerDF {
  timestamp: string;
  imagesSize: number;
  imagesReclaimable: number;
  containersSize: number;
  volumesSize: number;
  volumesReclaimable: number;
  buildCacheSize: number;
  buildCacheReclaimable: number;
}

export interface Alert {
  id: string;
  serverId: string;
  metric: string;
  condition: "gt" | "lt";
  threshold: number;
  durationSeconds: number;
  channel: "webhook";
  webhookUrl: string;
  active: boolean;
}

export interface MetricPoint {
  time: string;
  value: number;
}

export interface ServerSummary {
  server: Server;
  latestMetrics?: {
    cpuPercent: number;
    ramPercent: number;
    diskPercent: number;
    containersRunning: number;
  };
  activeAlerts: number;
}
