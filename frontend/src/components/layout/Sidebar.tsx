"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Server, Bell, Settings, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { href: "/overview", label: "Overview", icon: LayoutDashboard, roles: ["superadmin", "coordinator", "watcher"] },
    { href: "/servers", label: "Servers", icon: Server, roles: ["superadmin", "coordinator", "watcher"] },
    { href: "/alerts", label: "Alerts", icon: Bell, roles: ["superadmin", "coordinator", "watcher"] },
    { href: "/users", label: "Users", icon: Users, roles: ["superadmin", "coordinator"] },
    { href: "/settings", label: "Settings", icon: Settings, roles: ["superadmin"] },
  ];

  const visibleNav = navItems.filter(
    (item) => !user || item.roles.includes(user.role)
  );

  return (
    <aside className="w-60 bg-[#0D0D0D] border-r border-purple-900/30 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-purple-900/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <img src="/SUDOsyu.png" alt="Sudosyu" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none" style={{ textShadow: "0 0 16px rgba(168,85,247,0.8)" }}>
              Sudosyu
            </p>
            <p className="text-purple-500/60 text-[10px] mt-0.5">Server Monitor</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                active
                  ? "bg-purple-700/15 text-purple-400 border border-purple-700/30"
                  : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-purple-400" : "")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-purple-900/30 space-y-1">
        {user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-xs font-medium">{user.username}</p>
            <p className="text-gray-600 text-[10px] font-mono">{user.role}</p>
          </div>
        )}
        <button
          onClick={async () => {
            await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
            window.location.href = "/login";
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-900/10 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Logout
        </button>
        <p className="text-gray-700 text-[10px] font-mono px-3">v0.1.0</p>
      </div>
    </aside>
  );
}
