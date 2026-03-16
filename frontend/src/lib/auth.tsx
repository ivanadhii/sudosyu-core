"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "./types";

interface AuthContext {
  user: User | null;
  loading: boolean;
}

const Ctx = createContext<AuthContext>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          if (window.location.pathname !== "/login") window.location.href = "/login";
          return null;
        }
        return r.json();
      })
      .then((u) => { if (u) setUser(u); })
      .finally(() => setLoading(false));
  }, []);

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
