const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

import { TENANT_HOST } from "@/src/config/tenant";

// Single baked tenant hostname per white-label build. The `code` argument is
// kept for call-site compatibility but the resolved host is always the baked
// tenant — the backend resolves it exactly like a real subdomain.
export const hostForCode = (_code?: string) => TENANT_HOST;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiGet<T = any>(path: string, code: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "X-Tenant-Host": hostForCode(code), Accept: "application/json" },
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

export interface ProductPricing {
  metal: string;
  rate_per_gram: number;
  purity: string;
  purity_factor: number;
  weight_grams: number;
  metal_value: number;
  making: number;
  making_charge_type: string;
  live_price: number;
  stale: boolean;
  fetched_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  category_name?: string;
  kind: string;
  weight_grams: number;
  purity: string;
  making_charge: number;
  making_charge_type: string;
  price: number;
  live_price?: number;
  pricing?: ProductPricing | null;
  currency: string;
  images: string[];
  description: string;
  featured?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
}

export const getCategories = (code: string) => apiGet<Category[]>("/public/categories", code);
export const getProducts = (code: string, opts?: { category?: string; featured?: boolean }) => {
  const qs = new URLSearchParams();
  if (opts?.category) qs.set("category", opts.category);
  if (opts?.featured) qs.set("featured", "true");
  const q = qs.toString();
  return apiGet<Product[]>(`/public/products${q ? `?${q}` : ""}`, code);
};
export async function apiPost<T = any>(path: string, code: string, body: any): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "X-Tenant-Host": hostForCode(code), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const b = await res.json();
      detail = b?.detail ?? detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

export const getProduct = (code: string, id: string) =>
  apiGet<Product>(`/public/products/${id}`, code);

// ---- rates ----------------------------------------------------------------
export interface MetalRate {
  metal: string;
  inr_per_gram: number;
  margin_pct: number;
}
export interface Rates {
  gold: MetalRate;
  silver: MetalRate;
  usd_inr: number;
  fetched_at: string;
  stale: boolean;
  currency: string;
}
export const getRates = (code: string) => apiGet<Rates>("/public/rates", code);

// ---- SIP ------------------------------------------------------------------
export interface SipPlan {
  id: string;
  name: string;
  tagline: string;
  monthly_amount: number;
  tenure_months: number;
  bonus_months: number;
  metal: string;
  benefit_text: string;
  min_amount: number;
}
export interface SipInstallment {
  index: number;
  amount: number;
  due_date: string;
  status: "due" | "upcoming" | "paid";
  paid_at: string | null;
  rate_locked: number | null;
  grams: number | null;
}
export interface SipSummary {
  paid_installments: number;
  total_installments: number;
  total_paid: number;
  grams_accrued: number;
  current_rate: number | null;
  current_value: number | null;
}
export interface SipEnrollment {
  id: string;
  plan_id: string;
  plan_name: string;
  metal: string;
  monthly_amount: number;
  tenure_months: number;
  bonus_months: number;
  member_name: string;
  status: "active" | "matured";
  installments: SipInstallment[];
  summary: SipSummary;
}
export const getSipPlans = (code: string) => apiGet<SipPlan[]>("/public/sip/plans", code);
export const sipEnroll = (
  code: string,
  body: { guest_id: string; plan_id: string; monthly_amount?: number; name: string; phone: string }
) => apiPost<SipEnrollment>("/public/sip/enroll", code, body);
export const getSipEnrollments = (code: string, guestId: string) =>
  apiGet<SipEnrollment[]>(`/public/sip/enrollments?guest_id=${encodeURIComponent(guestId)}`, code);
export const sipPay = (code: string, enrollmentId: string, guestId: string) =>
  apiPost<SipEnrollment>(`/public/sip/enrollments/${enrollmentId}/pay`, code, { guest_id: guestId });

// ---- orders ---------------------------------------------------------------
export interface OrderLine {
  product_id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
}
export interface Order {
  id: string;
  order_no: string;
  items: OrderLine[];
  subtotal: number;
  currency: string;
  contact: { name: string; phone: string; email?: string };
  address: { line1: string; city: string; state?: string; pincode: string };
  status: string;
  created_at: string;
}
export const createOrder = (
  code: string,
  body: {
    guest_id: string;
    items: OrderLine[];
    contact: { name: string; phone: string; email?: string };
    address: { line1: string; city: string; state?: string; pincode: string };
    note?: string;
  }
) => apiPost<Order>("/public/orders", code, body);
export const getOrders = (code: string, guestId: string) =>
  apiGet<Order[]>(`/public/orders?guest_id=${encodeURIComponent(guestId)}`, code);
