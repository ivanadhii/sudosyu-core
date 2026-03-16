"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Trash2, Plus, Zap } from "lucide-react";
import type { Alert } from "@/lib/types";

type AlertTemplate = {
  id: string;
  name: string;
  rules: { metric: string; condition: string; threshold: number; durationSeconds: number }[];
};

type ContainerWatch = {
  id: string;
  containerName: string;
  webhookUrl: string;
  lastStatus: string;
};

type Container = {
  name: string;
  status: string;
};

// --- Metric Alerts Section ---
function MetricAlertsSection({ serverId }: { serverId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState({
    metric: "cpu",
    condition: "gt",
    threshold: "",
    durationSeconds: "300",
    webhookUrl: "",
  });

  const loadAlerts = useCallback(async () => {
    const res = await fetch(`/api/v1/alerts?server_id=${serverId}`, { credentials: "include" });
    if (res.ok) setAlerts(await res.json());
    setLoading(false);
  }, [serverId]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  useEffect(() => {
    fetch("/api/v1/alert-templates", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTemplates(data ?? []));
  }, []);

  async function applyTemplate() {
    if (!selectedTemplate) return;
    setApplying(true);
    await fetch(`/api/v1/servers/${serverId}/apply-template`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: selectedTemplate }),
    });
    setApplying(false);
    setSelectedTemplate("");
    loadAlerts();
  }

  const isUnreachable = form.metric === "unreachable";

  async function createAlert() {
    const body: Record<string, unknown> = {
      serverId,
      metric: form.metric,
      channel: "webhook",
      webhookUrl: form.webhookUrl,
    };
    if (isUnreachable) {
      body.condition = "gt";
      body.threshold = parseFloat(form.threshold);
      body.durationSeconds = 0;
    } else {
      body.condition = form.condition;
      body.threshold = parseFloat(form.threshold);
      body.durationSeconds = parseInt(form.durationSeconds);
    }
    const res = await fetch("/api/v1/alerts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ metric: "cpu", condition: "gt", threshold: "", durationSeconds: "300", webhookUrl: "" });
      loadAlerts();
    }
  }

  async function deleteAlert(id: string) {
    await fetch(`/api/v1/alerts/${id}`, { method: "DELETE", credentials: "include" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  const inputClass = "w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 transition-all";

  function alertDescription(a: Alert) {
    if (a.metric === "unreachable") return `offline > ${a.threshold}s`;
    return `${a.condition === "gt" ? ">" : "<"} ${a.threshold}%`;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-medium text-sm">Metric Alerts</h3>
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                className="bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500/60"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="">Apply template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTemplate && (
                <Button size="sm" onClick={applyTemplate} disabled={applying}>
                  <Zap className="w-3.5 h-3.5" /> {applying ? "Applying…" : "Apply"}
                </Button>
              )}
            </div>
          )}
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5" /> New Alert
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="p-5 border-purple-700/40">
          <h4 className="text-white text-sm font-medium mb-4">New Alert Rule</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Metric</label>
              <select className={inputClass} value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value, threshold: "", durationSeconds: "300" })}>
                <option value="cpu">CPU</option>
                <option value="ram">RAM</option>
                <option value="disk">Disk</option>
                <option value="unreachable">Unreachable</option>
              </select>
            </div>

            {!isUnreachable && (
              <div>
                <label className="block text-gray-500 text-xs mb-1.5">Condition</label>
                <select className={inputClass} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                  <option value="gt">&gt; greater than</option>
                  <option value="lt">&lt; less than</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-gray-500 text-xs mb-1.5">
                {isUnreachable ? "Timeout (seconds)" : "Threshold (%)"}
              </label>
              <input className={inputClass}
                placeholder={isUnreachable ? "60" : "90"}
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              />
            </div>

            {!isUnreachable && (
              <div>
                <label className="block text-gray-500 text-xs mb-1.5">Duration (seconds)</label>
                <input className={inputClass} placeholder="300" value={form.durationSeconds}
                  onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} />
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-gray-500 text-xs mb-1.5">Webhook URL</label>
              <input className={inputClass} placeholder="https://discord.com/api/webhooks/..."
                value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={createAlert} disabled={!form.threshold || !form.webhookUrl}>Create Alert</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24"><Spinner /></div>
      ) : (
        <Card>
          {alerts.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No alert rules yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-900/20">
                  {["Metric", "Condition", "Duration", "Status", ""].map((h) => (
                    <th key={h} className="text-left text-gray-500 font-medium px-4 py-3 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-purple-900/10 hover:bg-purple-900/5">
                    <td className="px-4 py-3 text-white font-mono text-xs">{alert.metric}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{alertDescription(alert)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {alert.metric === "unreachable" ? "—" : `${alert.durationSeconds}s`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={alert.active ? "green" : "gray"}>{alert.active ? "active" : "inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteAlert(alert.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

// --- Container Watches Section ---
function ContainerWatchesSection({ serverId }: { serverId: string }) {
  const [watches, setWatches] = useState<ContainerWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [containers, setContainers] = useState<Container[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loadingContainers, setLoadingContainers] = useState(false);

  const loadWatches = useCallback(async () => {
    const res = await fetch(`/api/v1/servers/${serverId}/container-watches`, { credentials: "include" });
    if (res.ok) setWatches(await res.json());
    setLoading(false);
  }, [serverId]);

  useEffect(() => { loadWatches(); }, [loadWatches]);

  async function openForm() {
    setShowForm(true);
    setSelected(new Set());
    setWebhookUrl("");
    setLoadingContainers(true);
    const res = await fetch(`/api/v1/servers/${serverId}/containers`, { credentials: "include" });
    if (res.ok) {
      const data: Container[] = await res.json();
      setContainers(data);
    }
    setLoadingContainers(false);
  }

  function toggleContainer(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function saveWatches() {
    if (selected.size === 0 || !webhookUrl) return;
    await fetch(`/api/v1/servers/${serverId}/container-watches`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containerNames: Array.from(selected), webhookUrl }),
    });
    setShowForm(false);
    loadWatches();
  }

  async function deleteWatch(id: string) {
    await fetch(`/api/v1/servers/${serverId}/container-watches/${id}`, { method: "DELETE", credentials: "include" });
    setWatches((prev) => prev.filter((w) => w.id !== id));
  }

  const inputClass = "w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 transition-all";

  const statusColor = (s: string) => {
    if (s === "running") return "green";
    if (s === "exited") return "red";
    if (s === "restarting") return "purple";
    return "gray";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-medium text-sm">Container Watches</h3>
        <Button size="sm" onClick={openForm}>
          <Plus className="w-3.5 h-3.5" /> Watch Containers
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 border-purple-700/40">
          <h4 className="text-white text-sm font-medium mb-4">Select Containers to Watch</h4>
          {loadingContainers ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : containers.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">No containers found.</p>
          ) : (
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {containers.map((c) => (
                <label key={c.name} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(c.name)}
                    onChange={() => toggleContainer(c.name)}
                    className="accent-purple-500"
                  />
                  <span className="text-white text-sm flex-1">{c.name}</span>
                  <Badge variant={statusColor(c.status) as "green" | "red" | "purple" | "gray"}>{c.status}</Badge>
                </label>
              ))}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Webhook URL</label>
              <input className={inputClass} placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveWatches} disabled={selected.size === 0 || !webhookUrl}>
                Watch {selected.size > 0 ? `(${selected.size})` : ""}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24"><Spinner /></div>
      ) : (
        <Card>
          {watches.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No containers being watched.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-900/20">
                  {["Container", "Last Status", ""].map((h) => (
                    <th key={h} className="text-left text-gray-500 font-medium px-4 py-3 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {watches.map((w) => (
                  <tr key={w.id} className="border-b border-purple-900/10 hover:bg-purple-900/5">
                    <td className="px-4 py-3 text-white text-sm font-mono">{w.containerName}</td>
                    <td className="px-4 py-3">
                      {w.lastStatus ? (
                        <Badge variant={statusColor(w.lastStatus) as "green" | "red" | "purple" | "gray"}>{w.lastStatus}</Badge>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteWatch(w.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

// --- Main AlertsTab ---
export function AlertsTab({ serverId }: { serverId: string }) {
  return (
    <div className="space-y-8">
      <MetricAlertsSection serverId={serverId} />
      <ContainerWatchesSection serverId={serverId} />
    </div>
  );
}
