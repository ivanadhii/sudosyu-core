"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }
      window.location.href = "/overview";
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 flex items-center justify-center mb-4">
            <img src="/SUDOsyu.png" alt="Sudosyu" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-white text-2xl font-bold" style={{ textShadow: "0 0 20px rgba(168,85,247,0.8)" }}>
            Sudosyu
          </h1>
          <p className="text-gray-500 text-sm mt-1">Server Monitor</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#111111] border border-purple-900/30 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#0A0A0A] border border-purple-900/30 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <Button type="submit" className="w-full justify-center" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
