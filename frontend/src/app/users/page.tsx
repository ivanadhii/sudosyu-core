"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Plus, Trash2, Shield } from "lucide-react";
import type { Role, User, Server, ServerAccess } from "@/lib/types";

const roleVariant: Record<Role, "purple" | "green" | "gray"> = {
  superadmin: "purple",
  coordinator: "green",
  watcher: "gray",
};

const ALL_PERMISSIONS = ["view_metrics", "view_docker", "manage_alerts", "export_data", "manage_watchers"] as const;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [, setUserAccess] = useState<ServerAccess[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "watcher" as Role });
  const [accessDraft, setAccessDraft] = useState<Record<string, string[]>>({});

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/v1/users", { credentials: "include" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (res.ok) setUsers(await res.json());
    setLoadingUsers(false);
  }, []);

  const loadServers = useCallback(async () => {
    const res = await fetch("/api/v1/servers", { credentials: "include" });
    if (res.ok) setServers(await res.json());
  }, []);

  useEffect(() => { loadUsers(); loadServers(); }, [loadUsers, loadServers]);

  async function selectUser(user: User) {
    if (selectedUser?.id === user.id) { setSelectedUser(null); return; }
    setSelectedUser(user);
    const res = await fetch(`/api/v1/users/${user.id}/access`, { credentials: "include" });
    if (res.ok) {
      const access: ServerAccess[] = await res.json();
      setUserAccess(access);
      const draft: Record<string, string[]> = {};
      access.forEach((a) => { draft[a.serverId] = a.permissions; });
      setAccessDraft(draft);
    }
  }

  function toggleServer(serverId: string) {
    setAccessDraft((prev) => {
      const next = { ...prev };
      if (next[serverId]) { delete next[serverId]; } else { next[serverId] = []; }
      return next;
    });
  }

  function togglePermission(serverId: string, perm: string) {
    setAccessDraft((prev) => {
      const perms = prev[serverId] ?? [];
      const next = perms.includes(perm) ? perms.filter((p) => p !== perm) : [...perms, perm];
      return { ...prev, [serverId]: next };
    });
  }

  async function saveAccess() {
    if (!selectedUser) return;
    const access = Object.entries(accessDraft).map(([serverId, permissions]) => ({ serverId, permissions }));
    await fetch(`/api/v1/users/${selectedUser.id}/access`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access }),
    });
  }

  async function createUser() {
    const hash = await fetch("/api/v1/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (hash.ok) {
      setShowForm(false);
      setNewUser({ username: "", email: "", password: "", role: "watcher" });
      loadUsers();
    }
  }

  async function deleteUser(id: string) {
    await fetch(`/api/v1/users/${id}`, { method: "DELETE", credentials: "include" });
    setUsers((prev) => prev.filter((u) => u.id !== id));
    if (selectedUser?.id === id) setSelectedUser(null);
  }

  const inputClass = "w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 transition-all";

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Users</h1>
            <p className="text-gray-500 text-sm mt-1">Manage access and permissions</p>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5" /> Add User
          </Button>
        </div>

        {showForm && (
          <Card className="p-5 mb-6 border-purple-700/40">
            <h3 className="text-white font-medium text-sm mb-4">New User</h3>
            <div className="grid grid-cols-2 gap-3">
              {([["Username", "username", "text", "john.doe"], ["Email", "email", "email", "john@example.com"], ["Password", "password", "password", "••••••••"]] as const).map(([label, key, type, placeholder]) => (
                <div key={key}>
                  <label className="block text-gray-500 text-xs mb-1.5">{label}</label>
                  <input type={type} placeholder={placeholder} value={newUser[key as keyof typeof newUser]}
                    onChange={(e) => setNewUser({ ...newUser, [key]: e.target.value })} className={inputClass} />
                </div>
              ))}
              <div>
                <label className="block text-gray-500 text-xs mb-1.5">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })} className={inputClass + " cursor-pointer"}>
                  <option value="coordinator">Coordinator</option>
                  <option value="watcher">Watcher</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={createUser} disabled={!newUser.username || !newUser.email || !newUser.password}>Create User</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            {loadingUsers ? <div className="flex items-center justify-center h-48"><Spinner /></div> : (
              <Card>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-900/20">
                      {["User", "Role", "Email", ""].map((h) => (
                        <th key={h} className="text-left text-gray-500 font-medium px-4 py-3 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} onClick={() => selectUser(user)}
                        className={`border-b border-purple-900/10 transition-colors cursor-pointer ${selectedUser?.id === user.id ? "bg-purple-900/10" : "hover:bg-purple-900/5"}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-purple-900/40 flex items-center justify-center">
                              <span className="text-purple-400 text-xs font-bold uppercase">{user.username[0]}</span>
                            </div>
                            <span className="text-white font-medium text-sm">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge variant={roleVariant[user.role as Role]}>{user.role}</Badge></td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{user.email}</td>
                        <td className="px-4 py-3">
                          {user.role !== "superadmin" && (
                            <button onClick={(e) => { e.stopPropagation(); deleteUser(user.id); }} className="text-gray-600 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>

          <div>
            {selectedUser ? (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <h3 className="text-white font-medium text-sm">{selectedUser.username} — Access</h3>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {servers.map((server) => {
                    const hasAccess = server.id in accessDraft;
                    return (
                      <div key={server.id} className="border border-purple-900/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <input type="checkbox" id={server.id} checked={hasAccess} onChange={() => toggleServer(server.id)} className="accent-purple-500" />
                          <label htmlFor={server.id} className="text-white text-sm cursor-pointer">{server.name}</label>
                        </div>
                        {selectedUser.role === "coordinator" && hasAccess && (
                          <div className="ml-5 space-y-1">
                            {ALL_PERMISSIONS.map((perm) => (
                              <div key={perm} className="flex items-center gap-2">
                                <input type="checkbox" id={`${server.id}-${perm}`} checked={(accessDraft[server.id] ?? []).includes(perm)}
                                  onChange={() => togglePermission(server.id, perm)} className="accent-purple-500" />
                                <label htmlFor={`${server.id}-${perm}`} className="text-gray-400 text-xs cursor-pointer font-mono">{perm}</label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button size="sm" className="w-full justify-center mt-4" onClick={saveAccess}>Save Access</Button>
              </Card>
            ) : (
              <Card className="p-5 flex flex-col items-center justify-center h-40">
                <Shield className="w-8 h-8 text-purple-900 mb-2" />
                <p className="text-gray-600 text-sm text-center">Select a user to manage their access</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
