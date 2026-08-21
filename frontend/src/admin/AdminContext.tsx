import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "admin_jwt";

export interface AdminInfo {
  tenant_code: string;
  business_name: string;
  role: string;
  status: string;
}

interface AdminCtx {
  ready: boolean;
  token: string | null;
  admin: AdminInfo | null;
  login: (tenantCode: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const Ctx = createContext<AdminCtx | undefined>(undefined);

let CURRENT_TOKEN: string | null = null;

export async function adminFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(CURRENT_TOKEN ? { Authorization: `Bearer ${CURRENT_TOKEN}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      detail = (await res.json())?.detail ?? detail;
    } catch {}
    const e: any = new Error(detail);
    e.status = res.status;
    throw e;
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(TOKEN_KEY, "");
      if (saved) {
        CURRENT_TOKEN = saved;
        try {
          const me = await adminFetch<AdminInfo>("/admin/me");
          setToken(saved);
          setAdmin(me);
        } catch {
          CURRENT_TOKEN = null;
          await storage.removeItem(TOKEN_KEY);
        }
      }
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (tenantCode: string, username: string, password: string) => {
    try {
      const data = await adminFetch<{ access_token: string } & AdminInfo>("/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ tenant_code: tenantCode, username, password }),
      });
      CURRENT_TOKEN = data.access_token;
      await storage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setAdmin({ tenant_code: data.tenant_code, business_name: data.business_name, role: data.role, status: "active" });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Login failed" };
    }
  }, []);

  const logout = useCallback(() => {
    CURRENT_TOKEN = null;
    storage.removeItem(TOKEN_KEY);
    setToken(null);
    setAdmin(null);
  }, []);

  return <Ctx.Provider value={{ ready, token, admin, login, logout }}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
