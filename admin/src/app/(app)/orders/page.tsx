"use client"

import { useEffect, useState } from "react"
import { FileDown, RotateCcw, ShoppingCart } from "lucide-react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import { canReturn, ORDER_FLOW, STATUS_COLOR } from "@/lib/status"
import {
  AlertBar,
  Badge,
  Button,
  Empty,
  PageHeader,
  Panel,
  Select,
  SkeletonRows,
  Table,
  Td,
  Th,
} from "@/components/ui"

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
  if (current === "cancelled" || current === "returned") return []
  const idx = ORDER_FLOW.indexOf(current as (typeof ORDER_FLOW)[number])
  if (idx < 0) return ORDER_FLOW.filter((s) => s !== "cancelled")
  const forward = ORDER_FLOW.slice(idx + 1).filter((s) => s !== "cancelled")
  if (current !== "delivered") {
    return [...forward, "cancelled" as const]
  }
  return forward
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = () =>
    api<Order[]>("/orders")
      .then(setOrders)
      .catch((e) => setError(e.message || "Failed to load orders"))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const handleStatus = async (id: string, status: string, reason?: string) => {
    setBusy(id + status)
    try {
      await api(`/orders/${id}/status`, {
        method: "PUT",
        body: reason ? { status, reason } : { status },
      })
      await load()
    } finally {
      setBusy(null)
    }
  }

  const handleReturn = async (o: Order) => {
    const ok = window.confirm(
      `Mark ${o.order_no} as returned? Stock will be restocked. Settle any refund offline — Razorpay is not charged back in v1.`
    )
    if (!ok) return
    const reason = window.prompt("Return reason (optional)", "") ?? undefined
    await handleStatus(o.id, "returned", reason?.trim() || undefined)
  }

  const handleInvoice = async (o: Order) => {
    setBusy(o.id + "invoice")
    try {
      const res = await fetch(`/api/admin/orders/${o.id}/invoice`, {
        credentials: "include",
        headers: { Accept: "application/pdf" },
      })
      if (!res.ok) {
        const text = await res.text()
        let detail = res.statusText || "Invoice failed"
        try {
          const j = JSON.parse(text)
          if (j?.detail) detail = String(j.detail)
        } catch {
          /* keep statusText */
        }
        throw new Error(detail)
      }
      const blob = await res.blob()
      const disp = res.headers.get("Content-Disposition") || ""
      const m = /filename="?([^"]+)"?/.exec(disp)
      const filename = m?.[1] || `${o.order_no || o.id}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not download invoice")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Advance online reservations through delivery"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            aria-label="Refresh orders"
            disabled={loading}
          >
            <RotateCcw size={13} aria-hidden />
            Refresh
          </Button>
        }
      />

      {error ? <AlertBar variant="danger" className="mb-4">{error}</AlertBar> : null}

      <Panel>
        {loading ? (
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
              <SkeletonRows rows={6} cols={6} />
            </tbody>
          </Table>
        ) : !orders.length ? (
          <Empty
            icon={<ShoppingCart size={28} />}
            title="No orders yet"
            description="Orders will appear here once customers place them online or via POS."
          />
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
              {orders.map((o) => {
                const nexts = nextStatuses(o.status)
                const nonCancelNexts = nexts.filter((s) => s !== "cancelled")

                return (
                  <tr key={o.id}>
                    <Td>
                      <div className="font-medium text-[13px]">{o.order_no}</div>
                      <div className="text-[11px] text-muted">
                        {o.items?.length ?? 0} item{(o.items?.length ?? 0) !== 1 ? "s" : ""}
                        {o.created_at
                          ? ` · ${new Date(o.created_at).toLocaleDateString("en-IN")}`
                          : ""}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-[13px]">{o.contact?.name || "—"}</div>
                      {o.contact?.phone ? (
                        <div className="text-[11px] text-muted">{o.contact.phone}</div>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="text-[12.5px] capitalize text-muted">
                        {o.channel || "online"}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <Badge status={o.status}>{o.status}</Badge>
                        {o.payment_status === "paid" ? (
                          <Badge status="paid" className="w-fit">paid</Badge>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="text-right font-semibold tabular-nums text-[13px]">
                      {money(o.subtotal)}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Invoice */}
                        {o.payment_status === "paid" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => handleInvoice(o)}
                            aria-label={`Download invoice ${o.order_no}`}
                          >
                            {busy === o.id + "invoice" ? (
                              "…"
                            ) : (
                              <>
                                <FileDown size={12} aria-hidden />
                                PDF
                              </>
                            )}
                          </Button>
                        ) : null}

                        {/* Return */}
                        {canReturn(o.status) ? (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy !== null}
                            onClick={() => handleReturn(o)}
                            aria-label={`Return order ${o.order_no}`}
                          >
                            {busy === o.id + "returned" ? (
                              "…"
                            ) : (
                              <>
                                <RotateCcw size={12} aria-hidden />
                                Return
                              </>
                            )}
                          </Button>
                        ) : null}

                        {/* Status advance: select + advance button for less button sprawl */}
                        {nonCancelNexts.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <StatusAdvance
                              statuses={nonCancelNexts as string[]}
                              orderId={o.id}
                              orderNo={o.order_no}
                              busy={busy}
                              onAdvance={handleStatus}
                            />
                          </div>
                        ) : null}

                        {/* Cancel only */}
                        {nexts.includes("cancelled") && nonCancelNexts.length === 0 ? (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy !== null}
                            onClick={() => handleStatus(o.id, "cancelled")}
                            aria-label={`Cancel order ${o.order_no}`}
                          >
                            {busy === o.id + "cancelled" ? "…" : "Cancel"}
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}

/* ── Status advance control ─────────────────────────────────────────────── */

function StatusAdvance({
  statuses,
  orderId,
  orderNo,
  busy,
  onAdvance,
}: {
  statuses: string[]
  orderId: string
  orderNo: string
  busy: string | null
  onAdvance: (id: string, status: string) => void
}) {
  const [selected, setSelected] = useState(statuses[0])

  // Keep selection valid if statuses changes
  if (!statuses.includes(selected) && statuses.length > 0) {
    setSelected(statuses[0])
  }

  return (
    <>
      {statuses.length > 1 ? (
        <Select
          className="h-7 w-auto text-[11.5px] pr-6"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label={`Next status for ${orderNo}`}
          disabled={busy !== null}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      ) : null}
      <Button
        size="sm"
        variant="accent"
        disabled={busy !== null}
        onClick={() => onAdvance(orderId, selected)}
        aria-label={`Mark ${orderNo} as ${selected}`}
      >
        {busy === orderId + selected ? "…" : statuses.length === 1 ? statuses[0] : "Mark →"}
      </Button>
    </>
  )
}
