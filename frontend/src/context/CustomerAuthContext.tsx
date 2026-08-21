import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { apiGet, apiPatch, apiPost } from "@/src/api/client";
import { setCustomerToken } from "@/src/api/customerToken";
import { storage } from "@/src/utils/storage";
import { TENANT_CODE } from "@/src/config/tenant";

const TOKEN_KEY = "customer_jwt";

export interface CustomerInfo {
  id: string;
  phone: string;
  name: string;
  email?: string | null;
}

interface CustomerAuthCtx {
  ready: boolean;
  token: string | null;
  customer: CustomerInfo | null;
  requestOtp: (phone: string) => Promise<{ ok: boolean; error?: string; devOtp?: string; devHint?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  updateProfile: (patch: { name?: string; email?: string }) => Promise<void>;
  requireAuth: () => boolean;
}

const Ctx = createContext<CustomerAuthCtx | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(TOKEN_KEY, "");
      if (saved) {
        setCustomerToken(saved);
        try {
          const me = await apiGet<CustomerInfo>("/public/me", TENANT_CODE, { auth: true });
          setToken(saved);
          setCustomer(me);
        } catch {
          setCustomerToken(null);
          await storage.removeItem(TOKEN_KEY);
        }
      }
      setReady(true);
    })();
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    try {
      const data = await apiPost<{ ok: boolean; dev_otp?: string; dev_hint?: string }>(
        "/public/auth/otp/request",
        TENANT_CODE,
        { phone }
      );
      return {
        ok: true,
        devOtp: data.dev_otp,
        devHint: data.dev_hint,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Could not send OTP" };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    try {
      const data = await apiPost<{ access_token: string; customer: CustomerInfo }>(
        "/public/auth/otp/verify",
        TENANT_CODE,
        { phone, code }
      );
      setCustomerToken(data.access_token);
      await storage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setCustomer(data.customer);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Invalid OTP" };
    }
  }, []);

  const logout = useCallback(() => {
    setCustomerToken(null);
    storage.removeItem(TOKEN_KEY);
    setToken(null);
    setCustomer(null);
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await apiGet<CustomerInfo>("/public/me", TENANT_CODE, { auth: true });
    setCustomer(me);
  }, []);

  const updateProfile = useCallback(async (patch: { name?: string; email?: string }) => {
    const me = await apiPatch<CustomerInfo>("/public/me", TENANT_CODE, patch, { auth: true });
    setCustomer(me);
  }, []);

  const requireAuth = useCallback(() => !!token, [token]);

  return (
    <Ctx.Provider value={{ ready, token, customer, requestOtp, verifyOtp, logout, refreshMe, updateProfile, requireAuth }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
