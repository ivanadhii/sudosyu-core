"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Trash2, Plus, Copy, Check } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Server } from "@/lib/types";

const tabs = ["Servers", "Super Keys", "Alert Templates", "Account"] as const;
type Tab = (typeof tabs)[number];

function generateAPIKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// --- Servers Tab ---
function ServersTab() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", apiKey: "", tags: "" });
  const [generatedKey, setGeneratedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const loadServers = useCallback(async () => {
    const res = await fetch("/api/v1/servers", { credentials: "include" });
    if (res.ok) setServers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadServers(); }, [loadServers]);

  function openForm() {
    const key = generateAPIKey();
    setGeneratedKey(key);
    setForm({ name: "", apiKey: key, tags: "" });
    setError("");
    setShowForm(true);
  }

  async function copyKey() {
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function addServer() {
    setError("");
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await fetch("/api/v1/servers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, apiKey: form.apiKey, tags }),
    });
    if (!res.ok) {
      setError("Failed to add server. Name may already be taken.");
      return;
    }
    setShowForm(false);
    loadServers();
  }

  async function deleteServer(id: string) {
    if (!confirm("Delete this server? All its data will be removed.")) return;
    await fetch(`/api/v1/servers/${id}`, { method: "DELETE", credentials: "include" });
    setServers((prev) => prev.filter((s) => s.id !== id));
  }

  function serverStatus(s: Server): "online" | "offline" {
    if (!s.lastSeenAt) return "offline";
    return Date.now() - new Date(s.lastSeenAt).getTime() < 60_000 ? "online" : "offline";
  }

  const inputClass = "w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 transition-all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">Registered servers and their API keys.</p>
        <Button size="sm" onClick={openForm}>
          <Plus className="w-3.5 h-3.5" /> Add Server
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 border-purple-700/40">
          <h3 className="text-white font-medium text-sm mb-4">Register New Server</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Server Name</label>
              <input
                className={inputClass}
                placeholder="prod-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Tags (comma separated)</label>
              <input
                className={inputClass}
                placeholder="production, singapore"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">API Key</label>
              <div className="flex gap-2">
                <input
                  className={inputClass + " font-mono text-xs"}
                  value={generatedKey}
                  readOnly
                />
                <button
                  onClick={copyKey}
                  className="px-3 py-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/40 rounded-lg text-purple-400 transition-all shrink-0"
                  title="Copy API key"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-yellow-500/70 text-xs mt-1.5">
                Copy this key now — it will not be shown again.
              </p>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={addServer} disabled={!form.name}>Add Server</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><Spinner /></div>
      ) : (
        <Card>
          {servers.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-10">No servers registered yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-900/20">
                  {["Name", "Status", "Tags", "Last seen", ""].map((h) => (
                    <th key={h} className="text-left text-gray-500 font-medium px-4 py-3 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => (
                  <tr key={server.id} className="border-b border-purple-900/10 hover:bg-purple-900/5">
                    <td className="px-4 py-3 text-white font-medium text-sm">{server.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={serverStatus(server) === "online" ? "green" : "red"}>
                        {serverStatus(server)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {server.tags.map((tag) => <Badge key={tag} variant="purple">{tag}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {server.lastSeenAt ? timeAgo(server.lastSeenAt) : "never"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteServer(server.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
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

// --- Super Keys Tab ---
function SuperKeysTab() {
  const [keys, setKeys] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    const res = await fetch("/api/v1/super-keys", { credentials: "include" });
    if (res.ok) setKeys(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  function openForm() {
    const key = generateAPIKey();
    setGeneratedKey(key);
    setName("");
    setCopied(false);
    setShowForm(true);
  }

  async function copyKey() {
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function addKey() {
    const res = await fetch("/api/v1/super-keys", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, apiKey: generatedKey }),
    });
    if (res.ok) {
      setShowForm(false);
      loadKeys();
    }
  }

  async function deleteKey(id: string) {
    if (!confirm("Delete this super key? Agents using it will stop sending data.")) return;
    await fetch(`/api/v1/super-keys/${id}`, { method: "DELETE", credentials: "include" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  const inputClass = "w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 transition-all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">One key works for all servers — server is auto-registered by name.</p>
        </div>
        <Button size="sm" onClick={openForm}>
          <Plus className="w-3.5 h-3.5" /> New Super Key
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 border-purple-700/40">
          <h3 className="text-white font-medium text-sm mb-4">Create Super API Key</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Key Name</label>
              <input
                className={inputClass}
                placeholder="e.g. production-fleet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">API Key</label>
              <div className="flex gap-2">
                <input className={inputClass + " font-mono text-xs"} value={generatedKey} readOnly />
                <button
                  onClick={copyKey}
                  className="px-3 py-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/40 rounded-lg text-purple-400 transition-all shrink-0"
                  title="Copy API key"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-yellow-500/70 text-xs mt-1.5">Copy this key now — it will not be shown again.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={addKey} disabled={!name}>Create Key</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><Spinner /></div>
      ) : (
        <Card>
          {keys.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-10">No super keys yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-900/20">
                  {["Name", "Created", ""].map((h) => (
                    <th key={h} className="text-left text-gray-500 font-medium px-4 py-3 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-purple-900/10 hover:bg-purple-900/5">
                    <td className="px-4 py-3 text-white font-medium text-sm">{k.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{timeAgo(k.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteKey(k.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
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

// --- Alert Templates Tab ---
type TemplateRule = {
  metric: string;
  condition: string;
  threshold: string;
  durationSeconds: string;
  webhookUrl: string;
};

type AlertTemplate = {
  id: string;
  name: string;
  createdAt: string;
  rules: {
    id: string;
    metric: string;
    condition: string;
    threshold: number;
    durationSeconds: number;
    webhookUrl: string;
  }[];
};

const emptyRule = (): TemplateRule => ({
  metric: "cpu",
  condition: "gt",
  threshold: "",
  durationSeconds: "300",
  webhookUrl: "",
});

function AlertTemplatesTab() {
  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rules, setRules] = useState<TemplateRule[]>([emptyRule()]);

  const inputClass = "w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 transition-all";
  const selectClass = inputClass;

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/v1/alert-templates", { credentials: "include" });
    if (res.ok) setTemplates((await res.json()) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function updateRule(i: number, patch: Partial<TemplateRule>) {
    setRules((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addRule() {
    setRules((prev) => [...prev, emptyRule()]);
  }

  function removeRule(i: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveTemplate() {
    if (!name || rules.length === 0) return;
    const body = {
      name,
      rules: rules.map((r) => ({
        metric: r.metric,
        condition: r.metric === "unreachable" ? "gt" : r.condition,
        threshold: parseFloat(r.threshold),
        durationSeconds: r.metric === "unreachable" ? 0 : parseInt(r.durationSeconds),
        webhookUrl: r.webhookUrl,
      })),
    };
    const res = await fetch("/api/v1/alert-templates", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowForm(false);
      setName("");
      setRules([emptyRule()]);
      loadTemplates();
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/v1/alert-templates/${id}`, { method: "DELETE", credentials: "include" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function ruleLabel(r: AlertTemplate["rules"][0]) {
    if (r.metric === "unreachable") return `unreachable > ${r.threshold}s`;
    return `${r.metric} ${r.condition === "gt" ? ">" : "<"} ${r.threshold}%  ${r.durationSeconds}s`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">Reusable alert sets — apply to any server in one click.</p>
        <Button size="sm" onClick={() => { setShowForm(true); setName(""); setRules([emptyRule()]); }}>
          <Plus className="w-3.5 h-3.5" /> New Template
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 border-purple-700/40 space-y-4">
          <h3 className="text-white font-medium text-sm">New Alert Template</h3>

          <div>
            <label className="block text-gray-500 text-xs mb-1.5">Template Name</label>
            <input className={inputClass} placeholder="e.g. Production Standard"
              value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Rules</span>
              <button onClick={addRule} className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Rule
              </button>
            </div>
            {rules.map((rule, i) => {
              const isUnreachable = rule.metric === "unreachable";
              return (
                <div key={i} className="border border-purple-900/20 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs">Rule {i + 1}</span>
                    {rules.length > 1 && (
                      <button onClick={() => removeRule(i)} className="text-gray-600 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-600 text-xs mb-1">Metric</label>
                      <select className={selectClass} value={rule.metric}
                        onChange={(e) => updateRule(i, { metric: e.target.value, threshold: "", durationSeconds: "300" })}>
                        <option value="cpu">CPU</option>
                        <option value="ram">RAM</option>
                        <option value="disk">Disk</option>
                        <option value="unreachable">Unreachable</option>
                      </select>
                    </div>
                    {!isUnreachable && (
                      <div>
                        <label className="block text-gray-600 text-xs mb-1">Condition</label>
                        <select className={selectClass} value={rule.condition}
                          onChange={(e) => updateRule(i, { condition: e.target.value })}>
                          <option value="gt">&gt; greater than</option>
                          <option value="lt">&lt; less than</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-gray-600 text-xs mb-1">
                        {isUnreachable ? "Timeout (s)" : "Threshold (%)"}
                      </label>
                      <input className={inputClass} placeholder={isUnreachable ? "60" : "90"}
                        value={rule.threshold} onChange={(e) => updateRule(i, { threshold: e.target.value })} />
                    </div>
                    {!isUnreachable && (
                      <div>
                        <label className="block text-gray-600 text-xs mb-1">Duration (s)</label>
                        <input className={inputClass} placeholder="300"
                          value={rule.durationSeconds} onChange={(e) => updateRule(i, { durationSeconds: e.target.value })} />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="block text-gray-600 text-xs mb-1">Webhook URL</label>
                      <input className={inputClass} placeholder="https://discord.com/api/webhooks/..."
                        value={rule.webhookUrl} onChange={(e) => updateRule(i, { webhookUrl: e.target.value })} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={saveTemplate}
              disabled={!name || rules.some((r) => !r.threshold || !r.webhookUrl)}>
              Save Template
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><Spinner /></div>
      ) : templates.length === 0 ? (
        <Card><p className="text-gray-600 text-sm text-center py-10">No templates yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-medium text-sm">{t.name}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{t.rules.length} rule{t.rules.length !== 1 ? "s" : ""}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.rules.map((r) => (
                      <span key={r.id} className="text-xs bg-purple-900/20 text-purple-300 border border-purple-900/30 rounded px-2 py-0.5 font-mono">
                        {ruleLabel(r)}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteTemplate(t.id)} className="text-gray-600 hover:text-red-400 transition-colors ml-4">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Account Tab ---
function AccountTab() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function changePassword() {
    if (form.newPassword !== form.confirm) {
      setStatus("error");
      setMsg("New passwords do not match.");
      return;
    }
    const res = await fetch("/api/v1/auth/change-password", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    });
    if (res.ok) {
      setStatus("success");
      setMsg("Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } else {
      setStatus("error");
      setMsg("Failed to change password. Check your current password.");
    }
  }

  const inputClass = "w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 transition-all";

  return (
    <div className="max-w-md space-y-6">
      <Card className="p-5">
        <h3 className="text-white font-medium text-sm mb-4">Change Password</h3>
        <div className="space-y-3">
          {[
            { label: "Current Password", key: "currentPassword" },
            { label: "New Password", key: "newPassword" },
            { label: "Confirm New Password", key: "confirm" },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-gray-500 text-xs mb-1.5">{label}</label>
              <input
                type="password"
                className={inputClass}
                placeholder="••••••••"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          {msg && (
            <p className={`text-xs ${status === "success" ? "text-green-400" : "text-red-400"}`}>{msg}</p>
          )}
          <Button
            size="sm"
            onClick={changePassword}
            disabled={!form.currentPassword || !form.newPassword || !form.confirm}
          >
            Update Password
          </Button>
        </div>
      </Card>
    </div>
  );
}

// --- Main Page ---
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Servers");

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">System configuration</p>
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

        {activeTab === "Servers" && <ServersTab />}
        {activeTab === "Super Keys" && <SuperKeysTab />}
        {activeTab === "Alert Templates" && <AlertTemplatesTab />}
        {activeTab === "Account" && <AccountTab />}
      </div>
    </AppLayout>
  );
}
