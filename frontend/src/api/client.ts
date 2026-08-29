const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

import { TENANT_HOST } from "@/src/config/tenant";
import { getCustomerToken } from "@/src/api/customerToken";

export const hostForCode = (_code?: string) => TENANT_HOST;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type FetchOpts = { auth?: boolean };

function headers(auth?: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "X-Tenant-Host": hostForCode(),
    Accept: "application/json",
  };
  if (auth) {
    const t = getCustomerToken();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  return h;
}

async function parseError(res: Response): Promise<string> {
  let detail = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    detail = body?.detail ?? detail;
  } catch {}
  return detail;
}

export async function apiGet<T = any>(path: string, _code: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { headers: headers(opts.auth) });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json();
}

export async function apiPost<T = any>(path: string, _code: string, body: any, opts: FetchOpts = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { ...headers(opts.auth), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json();
}

export async function apiPatch<T = any>(path: string, _code: string, body: any, opts: FetchOpts = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "PATCH",
    headers: { ...headers(opts.auth), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
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
export const getProducts = (
  code: string,
  opts?: {
    category?: string;
    featured?: boolean;
    q?: string;
    purity?: string;
    min_price?: number;
    max_price?: number;
    sort?: "price_asc" | "price_desc";
  }
) => {
  const qs = new URLSearchParams();
  if (opts?.category) qs.set("category", opts.category);
  if (opts?.featured) qs.set("featured", "true");
  if (opts?.q) qs.set("q", opts.q);
  if (opts?.purity) qs.set("purity", opts.purity);
  if (opts?.min_price != null) qs.set("min_price", String(opts.min_price));
  if (opts?.max_price != null) qs.set("max_price", String(opts.max_price));
  if (opts?.sort) qs.set("sort", opts.sort);
  const q = qs.toString();
  return apiGet<Product[]>(`/public/products${q ? `?${q}` : ""}`, code);
};
export const getProduct = (code: string, id: string) => apiGet<Product>(`/public/products/${id}`, code);

export interface MetalRate {
  metal: string;
  inr_per_gram: number;
  base_inr_per_gram: number;
  margin_pct: number;
  margin_inr_per_g: number;
}
export interface Rates {
  gold: MetalRate;
  silver: MetalRate;
  usd_inr: number;
  rate_city?: string | null;
  rate_state?: string | null;
  fetched_at: string;
  stale: boolean;
  currency: string;
  note?: string;
}
export const getRates = (code: string) => apiGet<Rates>("/public/rates", code);

export interface SavingsSummary {
  total_invested: number;
  current_value: number;
  gain: number;
  gold_grams: number;
  silver_grams: number;
}
export const getSavingsSummary = (code: string) =>
  apiGet<SavingsSummary>("/public/savings/summary", code, { auth: true });

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
  preferred_day?: number;
  member_name: string;
  status: "active" | "matured";
  installments: SipInstallment[];
  summary: SipSummary;
  mandate_status?: "none" | "pending" | "active" | "paused" | "cancelled" | "failed";
  razorpay_token_id?: string | null;
}
export const getSipPlans = (code: string) => apiGet<SipPlan[]>("/public/sip/plans", code);
export const sipEnroll = (
  code: string,
  body: { plan_id: string; monthly_amount?: number; name: string; phone?: string; preferred_day: number }
) => apiPost<SipEnrollment>("/public/sip/enroll", code, body, { auth: true });
export const getSipEnrollments = (code: string) =>
  apiGet<SipEnrollment[]>("/public/sip/enrollments", code, { auth: true });
export const sipPay = (code: string, enrollmentId: string) =>
  apiPost<{ razorpay_order_id: string; key_id: string; amount: number; currency?: string; mock?: boolean }>(
    `/public/sip/enrollments/${enrollmentId}/pay`,
    code,
    {},
    { auth: true }
  );
export const sipPayDevConfirm = (code: string, enrollmentId: string) =>
  apiPost<SipEnrollment>(`/public/sip/enrollments/${enrollmentId}/pay/dev-confirm`, code, {}, { auth: true });
export const sipPayConfirm = (
  code: string,
  enrollmentId: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) => apiPost<SipEnrollment>(`/public/sip/enrollments/${enrollmentId}/pay/confirm`, code, body, { auth: true });

export const sipMandateSetup = (code: string, enrollmentId: string) =>
  apiPost<{
    key_id: string;
    razorpay_order_id: string;
    amount: number;
    currency?: string;
    mock?: boolean;
    mandate_status?: string;
  }>(`/public/sip/enrollments/${enrollmentId}/mandate/setup`, code, {}, { auth: true });

export const sipMandateDevConfirm = (code: string, enrollmentId: string) =>
  apiPost<SipEnrollment>(`/public/sip/enrollments/${enrollmentId}/mandate/dev-confirm`, code, {}, { auth: true });

export const sipMandateConfirm = (
  code: string,
  enrollmentId: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) => apiPost<SipEnrollment>(`/public/sip/enrollments/${enrollmentId}/mandate/confirm`, code, body, { auth: true });

export const sipMandateCharge = (code: string, enrollmentId: string) =>
  apiPost<SipEnrollment | { ok: boolean; status: string; message?: string }>(
    `/public/sip/enrollments/${enrollmentId}/mandate/charge`,
    code,
    {},
    { auth: true }
  );

export interface MetalWallet {
  customer_id?: string;
  gold_grams: number;
  silver_grams: number;
  updated_at?: string | null;
}
export const getMetalWallet = (code: string) =>
  apiGet<MetalWallet>("/public/metal/wallet", code, { auth: true });
export const metalBuy = (code: string, body: { metal: "gold" | "silver"; amount_inr: number }) =>
  apiPost<{
    purchase_id: string;
    metal: string;
    estimated_grams: number;
    razorpay_order_id: string;
    key_id: string;
    amount: number;
    currency?: string;
    mock?: boolean;
  }>("/public/metal/buy", code, body, { auth: true });
export const metalBuyDevConfirm = (code: string, purchaseId: string) =>
  apiPost<{ purchase: Record<string, unknown>; wallet: MetalWallet }>(
    "/public/metal/buy/dev-confirm",
    code,
    { purchase_id: purchaseId },
    { auth: true }
  );
export const metalBuyConfirm = (
  code: string,
  body: {
    purchase_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }
) =>
  apiPost<{ purchase: Record<string, unknown>; wallet: MetalWallet }>(
    "/public/metal/buy/confirm",
    code,
    body,
    { auth: true }
  );

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
  payment_status?: string;
  created_at: string;
}
export const createOrder = (
  code: string,
  body: {
    items: OrderLine[];
    contact: { name: string; phone: string; email?: string };
    address: { line1: string; city: string; state?: string; pincode: string };
    note?: string;
  }
) => apiPost<Order>("/public/orders", code, body, { auth: true });
export const getOrders = (code: string) => apiGet<Order[]>("/public/orders", code, { auth: true });
export const getOrder = (code: string, id: string) => apiGet<Order>(`/public/orders/${id}`, code, { auth: true });
export const orderPay = (code: string, orderId: string) =>
  apiPost<{ razorpay_order_id: string; key_id: string; amount: number; currency?: string; mock?: boolean; rate_locked?: number }>(
    `/public/orders/${orderId}/pay`,
    code,
    {},
    { auth: true }
  );
export const orderPayDevConfirm = (code: string, orderId: string) =>
  apiPost<Order>(`/public/orders/${orderId}/pay/dev-confirm`, code, {}, { auth: true });
export const orderPayConfirm = (
  code: string,
  orderId: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) => apiPost<Order>(`/public/orders/${orderId}/pay/confirm`, code, body, { auth: true });

export async function downloadOrderInvoice(code: string, orderId: string): Promise<{ filename: string; base64: string }> {
  const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
  const { getCustomerToken } = await import("@/src/api/customerToken");
  const t = getCustomerToken();
  const res = await fetch(`${BASE}/api/public/orders/${orderId}/invoice`, {
    headers: {
      "X-Tenant-Host": hostForCode(code),
      Accept: "application/pdf",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
  if (!res.ok) {
    let detail = `Invoice failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  const disp = res.headers.get("Content-Disposition") || "";
  const m = /filename="?([^"]+)"?/.exec(disp);
  return { filename: m?.[1] || `${orderId}.pdf`, base64 };
}
