"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";

const metricNames: Record<string, { label: string; value: string }[]> = {
  cpu: [
    { label: "Total %", value: "total" },
    { label: "Load avg 1m", value: "load1" },
    { label: "Load avg 5m", value: "load5" },
    { label: "Load avg 15m", value: "load15" },
  ],
  ram: [
    { label: "Used %", value: "used_percent" },
    { label: "Used GB", value: "used_gb" },
    { label: "Swap used GB", value: "swap_used_gb" },
  ],
  disk: [
    { label: "Used %", value: "used_percent" },
  ],
  disk_io: [
    { label: "Read bytes/s", value: "read_bytes_per_sec" },
    { label: "Write bytes/s", value: "write_bytes_per_sec" },
    { label: "Read IOPS", value: "read_iops" },
    { label: "Write IOPS", value: "write_iops" },
  ],
  network: [
    { label: "Bytes recv/s", value: "bytes_recv_per_sec" },
    { label: "Bytes sent/s", value: "bytes_sent_per_sec" },
  ],
};

export function ExportTab({ serverId }: { serverId: string }) {
  const [metric, setMetric] = useState("cpu");
  const [metricName, setMetricName] = useState("total");
  const [resolution, setResolution] = useState("raw");
  const [format, setFormat] = useState("csv");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  function handleMetricChange(value: string) {
    setMetric(value);
    setMetricName(metricNames[value][0].value);
  }

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        server_id: serverId,
        metric,
        name: metricName,
        resolution,
        format,
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString(),
      });
      const res = await fetch(`/api/v1/export?${params}`, { credentials: "include" });
      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sudosyu_${metric}_${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all";
  const selectClass = inputClass + " cursor-pointer";

  return (
    <div className="max-w-lg">
      <Card className="p-6">
        <h3 className="text-white font-medium mb-5">Export Data</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Metric</label>
              <select className={selectClass} value={metric} onChange={(e) => handleMetricChange(e.target.value)}>
                <option value="cpu">CPU</option>
                <option value="ram">RAM</option>
                <option value="disk">Disk</option>
                <option value="disk_io">Disk I/O</option>
                <option value="network">Network</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Series</label>
              <select className={selectClass} value={metricName} onChange={(e) => setMetricName(e.target.value)}>
                {metricNames[metric].map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Start</label>
              <input type="datetime-local" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">End</label>
              <input type="datetime-local" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-gray-500 text-xs mb-1.5">Resolution</label>
            <select className={selectClass} value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <option value="raw">Raw (~10s)</option>
              <option value="1m">1 minute</option>
              <option value="5m">5 minutes</option>
              <option value="1h">1 hour</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 text-xs mb-1.5">Format</label>
            <select className={selectClass} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <Button
            className="w-full justify-center"
            onClick={handleExport}
            disabled={!startDate || !endDate || loading}
          >
            <Download className="w-4 h-4" />
            {loading ? "Exporting..." : "Download"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
