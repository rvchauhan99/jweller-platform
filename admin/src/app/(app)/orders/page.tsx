"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import { ORDER_FLOW, STATUS_COLOR } from "@/lib/status"
import { Badge, Button, Empty, PageHeader, Panel, Table, Td, Th } from "@/components/ui"

interface Order {
  id: string
  order_no: string
  status: string
  payment_status?: string
  subtotal: number
  channel?: string
  tender?: string
  created_at?: string
  contact?: { name?: string; phone?: string }
  items?: Array<{ name?: string; qty?: number }>
}

const nextStatuses = (current: string) => {
  const idx = ORDER_FLOW.indexOf(current as (typeof ORDER_FLOW)[number])
  if (idx < 0) return ORDER_FLOW.filter((s) => s !== "cancelled")
  const forward = ORDER_FLOW.slice(idx + 1).filter((s) => s !== "cancelled")
  if (current !== "cancelled" && current !== "delivered") {
    return [...forward, "cancelled" as const]
  }
  return forward
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () =>
    api<Order[]>("/orders")
      .then(setOrders)
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const handleStatus = async (id: string, status: string) => {
    setBusy(id + status)
    try {
      await api(`/orders/${id}/status`, { method: "PUT", body: { status } })
      await load()
    } finally {
      setBusy(null)
    }
  }

  const handleInvoice = (id: string) => {
    window.open(`/api/admin/orders/${id}/invoice`, "_blank", "noopener,noreferrer")
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle="Advance online reservations through delivery" />
      <Panel>
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : !orders.length ? (
          <Empty>No orders yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Channel</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <div className="font-medium">{o.order_no}</div>
                    <div className="text-xs text-muted">
                      {o.items?.length ?? 0} item(s)
                      {o.created_at ? ` · ${new Date(o.created_at).toLocaleString("en-IN")}` : ""}
                    </div>
                  </Td>
                  <Td>
                    <div>{o.contact?.name || "—"}</div>
                    <div className="text-xs text-muted">{o.contact?.phone}</div>
                  </Td>
                  <Td className="capitalize">{o.channel || "online"}</Td>
                  <Td>
                    <Badge color={STATUS_COLOR[o.status]}>{o.status}</Badge>
                    {o.payment_status === "paid" ? <span className="ml-2 text-xs text-muted">paid</span> : null}
                  </Td>
                  <Td className="text-right font-medium">{money(o.subtotal)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {o.payment_status === "paid" ? (
                        <Button size="sm" variant="secondary" onClick={() => handleInvoice(o.id)} aria-label={`Download invoice ${o.order_no}`}>
                          Invoice
                        </Button>
                      ) : null}
                      {nextStatuses(o.status).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={s === "cancelled" ? "danger" : "secondary"}
                          disabled={busy !== null}
                          onClick={() => handleStatus(o.id, s)}
                          aria-label={`Mark ${o.order_no} as ${s}`}
                        >
                          {busy === o.id + s ? "…" : s}
                        </Button>
                      ))}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
