"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import { STATUS_COLOR } from "@/lib/status"
import { Badge, Empty, PageHeader, Panel, Table, Td, Th } from "@/components/ui"

interface DashboardData {
  pending_orders: number
  sip_due: number
  low_stock_count: number
  sip_active: number
  rate_stale: boolean
  today_rate?: { inr_per_gram: number; margin_pct?: number }
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api<DashboardData>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load"))
  }, [])

  if (error) return <p className="text-sm text-danger">{error}</p>
  if (!data) return <p className="text-sm text-muted">Loading dashboard…</p>

  const sales = data.sales_today

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your work queue for today" />

      <section className="mb-5" aria-label="Work queue">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Needs attention</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/orders"
            className="rounded-lg border border-border bg-surface p-4 hover:border-accent"
            tabIndex={0}
            aria-label={`${data.pending_orders} pending orders`}
          >
            <p className="text-xs text-muted">Pending orders</p>
            <p
              className="mt-1 text-2xl font-semibold"
              style={{ color: data.pending_orders ? "var(--warning)" : "var(--text)" }}
            >
              {data.pending_orders}
            </p>
            <p className="mt-1 text-xs text-muted">Clear the pipeline</p>
          </Link>
          <Link
            href="/sip"
            className="rounded-lg border border-border bg-surface p-4 hover:border-accent"
            tabIndex={0}
            aria-label={`${data.sip_due} SIP due`}
          >
            <p className="text-xs text-muted">SIP due</p>
            <p
              className="mt-1 text-2xl font-semibold"
              style={{ color: data.sip_due ? "var(--warning)" : "var(--text)" }}
            >
              {data.sip_due}
            </p>
            <p className="mt-1 text-xs text-muted">{data.sip_active} active plans</p>
          </Link>
          <Link
            href="/inventory"
            className="rounded-lg border border-border bg-surface p-4 hover:border-accent"
            tabIndex={0}
            aria-label={`${data.low_stock_count} low stock items`}
          >
            <p className="text-xs text-muted">Low stock</p>
            <p
              className="mt-1 text-2xl font-semibold"
              style={{ color: data.low_stock_count ? "var(--danger)" : "var(--text)" }}
            >
              {data.low_stock_count}
            </p>
            <p className="mt-1 text-xs text-muted">≤ 2 units</p>
          </Link>
        </div>
      </section>

      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        <Panel className="p-4">
          <h2 className="text-sm font-semibold text-text">Today&apos;s sales</h2>
          <p className="mt-2 text-2xl font-semibold text-text">{money(sales?.total ?? 0)}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
            <span>Online {money(sales?.online ?? 0)}</span>
            <span>Offline {money(sales?.offline ?? 0)}</span>
            <span>{sales?.order_count ?? 0} bills</span>
          </div>
        </Panel>
        <Panel className="p-4">
          <h2 className="text-sm font-semibold text-text">Rate health</h2>
          {data.today_rate ? (
            <p className="mt-2 text-2xl font-semibold text-text">
              {money(data.today_rate.inr_per_gram)}
              <span className="text-sm font-normal text-muted"> /g gold</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-danger">Feed unavailable</p>
          )}
          <p className={`mt-2 text-sm ${data.rate_stale ? "text-warning" : "text-muted"}`}>
            {data.rate_stale
              ? "Rate feed is stale (older than 15 min)"
              : `Live · margin ${data.today_rate?.margin_pct ?? 0}%`}
          </p>
        </Panel>
        <Panel className="p-4" aria-label="Payment health">
          <h2 className="text-sm font-semibold text-text">Payment health</h2>
          {data.payment_health ? (
            <>
              <p className="mt-2 text-sm text-text">
                Gateway{" "}
                <span className={data.payment_health.gateway_enabled ? "text-[var(--accent)]" : "text-danger"}>
                  {data.payment_health.gateway_enabled ? "enabled" : "not configured"}
                </span>
                {" · "}
                {data.payment_health.mock_razorpay ? "mock client" : "live/Test API"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {data.payment_health.provider}
                {data.payment_health.key_id_masked ? ` · ${data.payment_health.key_id_masked}` : ""}
              </p>
              <p className="mt-2 text-xs text-muted">
                Last paid: {data.payment_health.last_paid_order_no || "—"}
                {data.payment_health.last_paid_at
                  ? ` · ${new Date(data.payment_health.last_paid_at).toLocaleString("en-IN")}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No payment health data</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-text">Recent orders</h2>
          <Panel>
            {!data.recent_orders.length ? (
              <Empty>No recent orders.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((o) => (
                    <tr key={o.id}>
                      <Td>
                        <div className="font-medium">{o.order_no}</div>
                        <div className="text-xs text-muted">
                          {o.contact?.name} · {o.items?.length ?? 0} item(s)
                        </div>
                      </Td>
                      <Td>
                        <Badge color={STATUS_COLOR[o.status]}>{o.status}</Badge>
                      </Td>
                      <Td className="text-right font-medium">{money(o.subtotal)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-text">Low stock</h2>
          <Panel>
            {!data.low_stock?.length ? (
              <Empty>Stock levels look fine.</Empty>
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
                      <Td>{p.name}</Td>
                      <Td className="text-right font-medium text-danger">{p.stock_qty}</Td>
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
