export const STATUS_COLOR: Record<string, string> = {
  reserved: "#B45309",
  confirmed: "#2563EB",
  packed: "#7C3AED",
  shipped: "#0891B2",
  delivered: "#15803D",
  cancelled: "#DC2626",
}

export const ORDER_FLOW = [
  "reserved",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const

export type OrderStatus = (typeof ORDER_FLOW)[number]
