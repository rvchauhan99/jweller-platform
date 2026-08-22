"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import { Badge, Empty, PageHeader, Panel, Table, Td, Th } from "@/components/ui"

interface Detail {
  id: string
  phone: string
  name: string
  email?: string | null
  order_count: number
  sip_count: number
  orders: Array<{
    id: string
    order_no: string
    status: string
    subtotal: number
    created_at?: string
  }>
  sip_enrollments: Array<{
    id: string
    plan_name?: string
    status?: string
    summary?: { total_paid?: number; grams_accrued?: number }
  }>
}

export default function CustomerDetailPage() {
  const params = useParams()
  const id = decodeURIComponent(String(params.id || ""))
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    api<Detail>(`/customers/${encodeURIComponent(id)}`)
      .then(setData)
      .catch((e) => setError(e.message || "Not found"))
  }, [id])

  if (error) return <p className="text-sm text-danger">{error}</p>
  if (!data) return <p className="text-sm text-muted">Loading…</p>

  return (
    <div>
      <PageHeader
        title={data.name}
        subtitle={`${data.phone}${data.email ? ` · ${data.email}` : ""}`}
        actions={
          <Link href="/customers" className="text-sm text-accent hover:underline" tabIndex={0}>
            ← Customers
          </Link>
        }
      />

      <div className="mb-5 flex gap-6 text-sm text-muted">
        <span>
          <strong className="text-text">{data.order_count}</strong> orders
        </span>
        <span>
          <strong className="text-text">{data.sip_count}</strong> SIP
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Orders</h2>
          <Panel>
            {!data.orders?.length ? (
              <Empty>No orders.</Empty>
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
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <Td>
                        <div className="font-medium">{o.order_no}</div>
                        <div className="text-xs text-muted">
                          {o.created_at ? new Date(o.created_at).toLocaleString("en-IN") : ""}
                        </div>
                      </Td>
                      <Td>
                        <Badge status={o.status}>{o.status}</Badge>
                      </Td>
                      <Td className="text-right">{money(o.subtotal)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">SIP</h2>
          <Panel>
            {!data.sip_enrollments?.length ? (
              <Empty>No SIP enrollments.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Plan</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Paid</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.sip_enrollments.map((e) => (
                    <tr key={e.id}>
                      <Td>{e.plan_name}</Td>
                      <Td className="capitalize">{e.status}</Td>
                      <Td className="text-right">{money(e.summary?.total_paid ?? 0)}</Td>
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
