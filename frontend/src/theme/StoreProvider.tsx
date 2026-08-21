import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiGet } from "@/src/api/client";
import { TENANT_CODE } from "@/src/config/tenant";
import { DEFAULT_THEME, resolveTheme, Theme } from "@/src/theme/tokens";

interface Bootstrap {
  business_name: string;
  tenant_code: string;
  logo_url?: string | null;
  tagline?: string;
  status: string;
  theme: any;
  homepage_sections: { type: string }[];
}

interface Cms {
  hero_title?: string;
  hero_subtitle?: string;
  hero_image?: string;
  about_title?: string;
  about_text?: string;
  rate?: { metal: string; value: string; note?: string };
}

type Status = "loading" | "ready" | "notfound" | "unavailable" | "error";

interface StoreContextValue {
  code: string;
  status: Status;
  theme: Theme;
  businessName: string;
  tagline?: string;
  logoUrl?: string | null;
  sections: { type: string }[];
  cms: Cms | null;
  errorMessage?: string;
  reload: () => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const code = TENANT_CODE; // baked per white-label build — never changes at runtime
  const [status, setStatus] = useState<Status>("loading");
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [cms, setCms] = useState<Cms | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [tick, setTick] = useState(0);

  const loadStore = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(undefined);
    try {
      const b = await apiGet<Bootstrap>("/public/bootstrap", code);
      let c: Cms | null = null;
      try {
        c = await apiGet<Cms>("/public/cms", code);
      } catch {}
      setBoot(b);
      setCms(c);
      setStatus("ready");
    } catch (e: any) {
      const httpStatus = e?.status;
      if (httpStatus === 404) {
        setStatus("notfound");
        setErrorMessage("This store is not available.");
      } else if (httpStatus === 503) {
        setStatus("unavailable");
        setErrorMessage("This store is temporarily unavailable.");
      } else {
        setStatus("error");
        setErrorMessage("Something went wrong. Please try again.");
      }
    }
  }, [code]);

  useEffect(() => {
    loadStore();
  }, [loadStore, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const theme = useMemo(() => (boot ? resolveTheme(boot.theme) : DEFAULT_THEME), [boot]);

  const value: StoreContextValue = {
    code,
    status,
    theme,
    businessName: boot?.business_name ?? "",
    tagline: boot?.tagline,
    logoUrl: boot?.logo_url,
    sections: boot?.homepage_sections ?? [],
    cms,
    errorMessage,
    reload,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useTheme(): Theme {
  return useStore().theme;
}
