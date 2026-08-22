"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, Package, Coins, ShoppingCart, Zap, Activity, TrendingUp } from "lucide-react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import {
  AlertBar,
  Badge,
  Empty,
  PageHeader,
  Panel,
  SectionHeading,
  Skeleton,
  SkeletonRows,
  Stat,
  StatusDot,
  Table,
  Td,
  Th,
} from "@/components/ui"

interface DashboardData {
  pending_orders: number
  sip_due: number
  low_stock_count: number
  sip_active: number
  rate_stale: boolean
  today_rate?: { inr_per_gram: number; margin_pct?: number; margin_inr_per_g?: number }
  sales_today?: { online: number; offline: number; total: number; order_count: number }
  recent_orders: Array<{
    id: string
    order_no: string
    status: string
    subtotal: number
    contact?: { name?: string }
    items?: unknown[]
  }>
  low_stock: Array<{ id: string; name: string; stock_qty: number }>
  payment_health?: {
    gateway_enabled: boolean
    provider: string
    key_id_masked?: string | null
    mock_razorpay: boolean
    last_paid_order_no?: string | null
    last_paid_at?: string | null
  }
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-5">
        <Skeleton className="h-6 w-28 mb-1" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Urgency strip skeleton */}
      <div className="mb-5 rounded-lg border border-border bg-surface overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-b-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-8 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
      {/* Status rows skeleton */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <Skeleton className="h-4 w-24 mb-3" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between py-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </Panel>
        <Panel className="p-4">
          <Skeleton className="h-4 w-28 mb-3" />
          {[0, 1].map((i) => (
            <div key={i} className="flex justify-between py-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </Panel>
      </div>
      {/* Tables skeleton */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <div className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-28" />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              <SkeletonRows rows={5} cols={3} />
            </tbody>
          </Table>
        </Panel>
        <Panel>
          <div className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-20" />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th className="text-right">Qty</Th>
              </tr>
            </thead>
            <tbody>
              <SkeletonRows rows={4} cols={2} />
            </tbody>
          </Table>
        </Panel>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api<DashboardData>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load dashboard"))
  }, [])

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Your work queue for today" />
        <AlertBar variant="danger">{error}</AlertBar>
      </div>
    )
  }

  if (!data) return <DashboardSkeleton />

  const sales = data.sales_today
  const ph = data.payment_health

  const urgencyItems = [
    {
      href: "/orders",
      icon: ShoppingCart,
      label: "Pending orders",
      count: data.pending_orders,
      cta: data.pending_orders ? "Clear the pipeline →" : "All clear",
      variant: data.pending_orders ? "warning" : "success",
      urgent: data.pending_orders > 0,
    },
    {
      href: "/sip",
      icon: Coins,
      label: "SIP due today",
      count: data.sip_due,
      cta: data.sip_due
        ? `${data.sip_active} active plan${data.sip_active !== 1 ? "s" : ""} →`
        : `${data.sip_active} active plan${data.sip_active !== 1 ? "s" : ""}`,
      variant: data.sip_due ? "warning" : "success",
      urgent: data.sip_due > 0,
    },
    {
      href: "/inventory",
      icon: Package,
      label: "Low / out of stock",
      count: data.low_stock_count,
      cta: data.low_stock_count ? "Fix stock →" : "Levels OK",
      variant: data.low_stock_count ? "danger" : "success",
      urgent: data.low_stock_count > 0,
    },
  ] as const

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your work queue for today" />

      {/* ── 1. Urgency strip ──────────────────────────────────────────── */}
      <section className="mb-5" aria-label="Work queue">
        <SectionHeading>Needs attention</SectionHeading>
        <Panel className="overflow-hidden">
          {urgencyItems.map(({ href, icon: Icon, label, count, cta, variant, urgent }) => (
            <Link
              key={href}
              href={href}
              tabIndex={0}
              aria-label={`${count} ${label}`}
              className="group flex items-center justify-between gap-4 px-4 py-3.5 border-b border-border last:border-b-0 transition-colors hover:bg-surface-alt"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                  style={{
                    background: urgent
                      ? variant === "danger"
                        ? "var(--danger-soft)"
                        : "var(--warning-soft)"
                      : "var(--success-soft)",
                    color: urgent
                      ? variant === "danger"
                        ? "var(--danger)"
                        : "var(--warning)"
                      : "var(--success)",
                  }}
                >
                  <Icon size={15} aria-hidden />
                </div>
                <span className="text-[13px] font-medium text-text">{label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-[18px] font-bold tabular-nums leading-none"
                  style={{
                    color: urgent
                      ? variant === "danger"
                        ? "var(--danger)"
                        : "var(--warning)"
                      : "var(--success)",
                  }}
                >
                  {count}
                </span>
                <span className="text-[12px] text-muted group-hover:text-accent-text transition-colors">
                  {cta}
                </span>
              </div>
            </Link>
          ))}
        </Panel>
      </section>

      {/* ── 2. Operational status ─────────────────────────────────────── */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {/* Today's sales */}
        <Panel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={13} className="text-muted" aria-hidden />
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
              Today&apos;s sales
            </h2>
          </div>
          <p className="text-[22px] font-bold tabular-nums text-text leading-none mb-3">
            {money(sales?.total ?? 0)}
          </p>
          <div className="space-y-0 divide-y divide-border">
            <Stat label="Online" value={money(sales?.online ?? 0)} />
            <Stat label="Offline / POS" value={money(sales?.offline ?? 0)} />
            <Stat label="Bills" value={sales?.order_count ?? 0} />
          </div>
        </Panel>

        {/* Rate + payment health */}
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={13} className="text-muted" aria-hidden />
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                Rate health
              </h2>
              {data.rate_stale ? (
                <span className="ml-auto">
                  <Badge status="warning">Stale</Badge>
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1.5">
                  <StatusDot variant="success" />
                  <span className="text-[11px] text-success font-medium">Live</span>
                </span>
              )}
            </div>
            {data.today_rate ? (
              <div className="space-y-0 divide-y divide-border">
                <Stat
                  label="Gold sell rate"
                  value={`${money(data.today_rate.inr_per_gram)} /g`}
                />
                <Stat
                  label="Margin"
                  value={`${data.today_rate.margin_pct ?? 0}% + ₹${data.today_rate.margin_inr_per_g ?? 0}/g`}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 py-1">
                <AlertTriangle size={13} className="text-danger" />
                <span className="text-[12.5px] text-danger">Rate feed unavailable</span>
              </div>
            )}
            {data.rate_stale && (
              <p className="mt-2 text-[11.5px] text-warning">
                Feed is older than 15 min — rates may not reflect market.
              </p>
            )}
          </Panel>

          <Panel className="p-4" aria-label="Payment health">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={13} className="text-muted" aria-hidden />
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                Payment health
              </h2>
              {ph ? (
                <span className="ml-auto flex items-center gap-1.5">
                  <StatusDot variant={ph.gateway_enabled ? "success" : "danger"} />
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: ph.gateway_enabled ? "var(--success)" : "var(--danger)" }}
                  >
                    {ph.gateway_enabled ? "Enabled" : "Not configured"}
                  </span>
                </span>
              ) : null}
            </div>
            {ph ? (
              <div className="space-y-0 divide-y divide-border">
                <Stat
                  label="Provider"
                  value={ph.provider}
                  meta={ph.mock_razorpay ? "(mock)" : "(live/test API)"}
                />
                {ph.key_id_masked ? (
                  <Stat label="Key" value={ph.key_id_masked} />
                ) : null}
                {ph.last_paid_order_no ? (
                  <Stat
                    label="Last payment"
                    value={ph.last_paid_order_no}
                    meta={
                      ph.last_paid_at
                        ? new Date(ph.last_paid_at).toLocaleString("en-IN")
                        : undefined
                    }
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted">No payment health data</p>
            )}
          </Panel>
        </div>
      </div>

      {/* ── 3. Recent orders + low stock ─────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Recent orders */}
        <div>
          <SectionHeading>Recent orders</SectionHeading>
          <Panel>
            {!data.recent_orders.length ? (
              <Empty
                icon={<ShoppingCart size={24} />}
                title="No recent orders"
                description="Orders will appear here once customers start placing them."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((o) => (
                    <tr key={o.id}>
                      <Td>
                        <div className="font-medium text-[13px]">{o.order_no}</div>
                        <div className="text-[11px] text-muted">
                          {o.items?.length ?? 0} item{(o.items?.length ?? 0) !== 1 ? "s" : ""}
                        </div>
                      </Td>
                      <Td>
                        <span className="text-[13px]">{o.contact?.name ?? "—"}</span>
                      </Td>
                      <Td>
                        <Badge status={o.status}>{o.status}</Badge>
                      </Td>
                      <Td className="text-right font-semibold tabular-nums text-[13px]">
                        {money(o.subtotal)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>

        {/* Low stock */}
        <div>
          <SectionHeading>Low stock</SectionHeading>
          <Panel>
            {!data.low_stock?.length ? (
              <Empty
                icon={<Package size={24} />}
                title="Stock levels OK"
                description="No items below threshold."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th className="text-right">Qty</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.low_stock.map((p) => (
                    <tr key={p.id}>
                      <Td>
                        <span className="text-[13px]">{p.name}</span>
                      </Td>
                      <Td className="text-right">
                        <Badge status={p.stock_qty === 0 ? "cancelled" : "reserved"}>
                          {p.stock_qty}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
