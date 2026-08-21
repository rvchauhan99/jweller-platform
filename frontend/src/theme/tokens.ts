// Static design tokens + runtime theme resolver.
// Colors and fonts are NEVER hardcoded in components — they flow from the
// per-tenant theme object returned by /api/public/bootstrap.

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;
export const RADIUS = { sm: 0, md: 4, lg: 8, pill: 999 } as const;
export const FONT_SIZE = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 42,
} as const;

// Display (heading) family -> registered weights.
const HEADING: Record<string, { reg: string; bold: string }> = {
  "Cormorant Garamond": { reg: "Cormorant500", bold: "Cormorant600" },
  "Playfair Display": { reg: "Playfair600", bold: "Playfair600" },
  "Source Serif 4": { reg: "SourceSerif400", bold: "SourceSerif400" },
  "DM Sans": { reg: "DMSans500", bold: "DMSans500" },
  Inter: { reg: "Inter500", bold: "Inter500" },
};

// Body (text) family -> registered weights.
const BODY: Record<string, { reg: string; med: string }> = {
  "DM Sans": { reg: "DMSans400", med: "DMSans500" },
  Inter: { reg: "Inter400", med: "Inter500" },
  "Cormorant Garamond": { reg: "Cormorant500", med: "Cormorant600" },
  "Playfair Display": { reg: "Playfair600", med: "Playfair600" },
  "Source Serif 4": { reg: "SourceSerif400", med: "SourceSerif400" },
};

// Neutral fallback used before the first bootstrap resolves (ivory/gold).
const FALLBACK_COLORS = {
  primary: "#BFA75D",
  onPrimary: "#FFFFFF",
  secondary: "#8C7738",
  accent: "#BFA75D",
  background: "#FAFAF7",
  surface: "#FFFFFF",
  text: "#1A1A18",
  muted: "#6B6B64",
  border: "#E0DCD1",
  headerBg: "#FAFAF7",
  headerText: "#1A1A18",
  footerBg: "#1A1A18",
  footerText: "#FAFAF7",
};

export type ThemeColors = typeof FALLBACK_COLORS;

export interface Theme {
  mode: "light" | "dark";
  presetId?: string;
  colors: ThemeColors;
  fonts: { heading: string; headingBold: string; body: string; bodyMedium: string };
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  fontSize: typeof FONT_SIZE;
}

export interface RemoteTheme {
  preset_id?: string;
  mode?: "light" | "dark";
  colors?: Partial<ThemeColors>;
  fonts?: { heading?: string; body?: string };
}

export function resolveTheme(remote?: RemoteTheme): Theme {
  const h = HEADING[remote?.fonts?.heading ?? ""] ?? HEADING["Cormorant Garamond"];
  const b = BODY[remote?.fonts?.body ?? ""] ?? BODY["DM Sans"];
  return {
    mode: remote?.mode ?? "light",
    presetId: remote?.preset_id,
    colors: { ...FALLBACK_COLORS, ...(remote?.colors ?? {}) },
    fonts: { heading: h.reg, headingBold: h.bold, body: b.reg, bodyMedium: b.med },
    spacing: SPACING,
    radius: RADIUS,
    fontSize: FONT_SIZE,
  };
}

export const DEFAULT_THEME = resolveTheme();

export function formatMoney(value: number, currency = "₹"): string {
  return `${currency} ${Math.round(value).toLocaleString("en-IN")}`;
}
