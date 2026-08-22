import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "admin_jwt";

export interface AdminInfo {
  tenant_code: string;
  business_name: string;
  role: string;
  status: string;
  username?: string;
  two_fa_enabled?: boolean;
  phone_masked?: string | null;
}

interface AdminCtx {
  ready: boolean;
  token: string | null;
  admin: AdminInfo | null;
  login: (
    tenantCode: string,
    username: string,
    password: string,
    totp?: string
  ) => Promise<{ ok: boolean; two_fa_required?: boolean; error?: string }>;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

function usernameFromJwt(token: string): string | undefined {
  try {
    const part = token.split(".")[1];
    if (!part) return undefined;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(normalized));
    return typeof json?.username === "string" ? json.username : undefined;
  } catch {
    return undefined;
  }
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

/** Download admin PDF (invoice) as base64 — Bearer auth, not JSON. */
export async function adminDownloadPdf(path: string): Promise<{ filename: string; base64: string }> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: {
      Accept: "application/pdf",
      ...(CURRENT_TOKEN ? { Authorization: `Bearer ${CURRENT_TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    let detail = `Download failed (${res.status})`;
    try {
      detail = (await res.json())?.detail ?? detail;
    } catch {}
    const e: any = new Error(detail);
    e.status = res.status;
    throw e;
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  const disp = res.headers.get("Content-Disposition") || "";
  const m = /filename="?([^"]+)"?/.exec(disp);
  const leaf = path.split("/").filter(Boolean).pop() || "document";
  return { filename: m?.[1] || `${leaf}.pdf`, base64 };
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
          setAdmin({ ...me, username: me.username || usernameFromJwt(saved) });
        } catch {
          CURRENT_TOKEN = null;
          await storage.removeItem(TOKEN_KEY);
        }
      }
      setReady(true);
    })();
  }, []);

  const refreshMe = useCallback(async () => {
    if (!CURRENT_TOKEN) return;
    const me = await adminFetch<AdminInfo>("/admin/me");
    setAdmin({ ...me, username: me.username || usernameFromJwt(CURRENT_TOKEN) });
  }, []);

  const login = useCallback(async (tenantCode: string, username: string, password: string, totp?: string) => {
    try {
      const data = await adminFetch<{ access_token?: string; two_fa_required?: boolean } & AdminInfo>(
        "/admin/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            tenant_code: tenantCode,
            username,
            password,
            totp: totp || undefined,
          }),
        }
      );
      if (data.two_fa_required) {
        return { ok: false, two_fa_required: true };
      }
      if (!data.access_token) {
        return { ok: false, error: "Login failed" };
      }
      CURRENT_TOKEN = data.access_token;
      await storage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setAdmin({
        tenant_code: data.tenant_code,
        business_name: data.business_name,
        role: data.role,
        status: "active",
        username: data.username || usernameFromJwt(data.access_token),
        two_fa_enabled: data.two_fa_enabled,
      });
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

  return <Ctx.Provider value={{ ready, token, admin, login, refreshMe, logout }}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
