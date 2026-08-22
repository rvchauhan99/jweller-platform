// Neutral PLATFORM tokens for the jeweler admin — deliberately NOT the tenant's
// gold brand. Dense ERP feel (Stripe / Linear / Shopify Admin).
export const A = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F3F5",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E4E8EE",
  primary: "#111827",
  onPrimary: "#FFFFFF",
  accent: "#2563EB",
  accentSoft: "#EFF4FF",
  success: "#15803D",
  warning: "#B45309",
  danger: "#DC2626",
  radius: 10,
  radiusSm: 8,
  font: "Inter400",
  fontMed: "Inter500",
};

export const money = (v: number, c = "₹") => `${c} ${Math.round(v || 0).toLocaleString("en-IN")}`;

export const STATUS_COLOR: Record<string, string> = {
  reserved: "#B45309",
  confirmed: "#2563EB",
  packed: "#7C3AED",
  shipped: "#0891B2",
  delivered: "#15803D",
  cancelled: "#DC2626",
  returned: "#9A3412",
};
