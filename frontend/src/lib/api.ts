const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request("/api/v1/auth/logout", { method: "POST" }),
  me: () => request("/api/v1/auth/me"),

  // Servers
  getServers: () => request("/api/v1/servers"),
  getServer: (id: string) => request(`/api/v1/servers/${id}`),
  getMetrics: (id: string, params: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/v1/servers/${id}/metrics?${q}`);
  },
  getContainers: (id: string) => request(`/api/v1/servers/${id}/containers`),
  getDockerDF: (id: string) => request(`/api/v1/servers/${id}/docker-df`),

  // Alerts
  getAlerts: (serverId?: string) =>
    request(`/api/v1/alerts${serverId ? `?server_id=${serverId}` : ""}`),
  createAlert: (data: Partial<Alert>) =>
    request("/api/v1/alerts", { method: "POST", body: JSON.stringify(data) }),
  deleteAlert: (id: string) =>
    request(`/api/v1/alerts/${id}`, { method: "DELETE" }),

  // Users (superadmin)
  getUsers: () => request("/api/v1/users"),
  createUser: (data: { username: string; email: string; password: string; role: Role }) =>
    request("/api/v1/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request(`/api/v1/users/${id}`, { method: "DELETE" }),
  getUserAccess: (id: string) => request(`/api/v1/users/${id}/access`),
  setUserAccess: (id: string, access: { serverId: string; permissions: Permission[] }[]) =>
    request(`/api/v1/users/${id}/access`, {
      method: "PUT",
      body: JSON.stringify({ access }),
    }),

  // Export
  exportData: (params: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return `${API_BASE}/api/v1/export?${q}`;
  },
};

import type { Role, Permission, Alert } from "./types";
