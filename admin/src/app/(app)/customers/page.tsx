"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Empty, Field, Input, PageHeader, Panel, Table, Td, Th } from "@/components/ui"

interface Customer {
  id: string
  phone: string
  name: string
  email?: string | null
  order_count: number
  sip_count: number
}

export default function CustomersPage() {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const load = (query?: string) => {
    setLoading(true)
    api<Customer[]>("/customers", { query: query ? { q: query } : undefined })
      .then(setRows)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    load(q.trim())
  }

  return (
    <div>
      <PageHeader title="Customers" subtitle="Search within this tenant only" />
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <Field label="Search" htmlFor="q" className="flex-1">
          <Input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, or email"
            aria-label="Search customers"
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit" aria-label="Search">
            Search
          </Button>
        </div>
      </form>
      <Panel>
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : !rows.length ? (
          <Empty>No customers found.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Email</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">SIP</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <Link
                      href={`/customers/${encodeURIComponent(c.id)}`}
                      className="font-medium text-accent hover:underline"
                      tabIndex={0}
                      aria-label={`Open ${c.name}`}
                    >
                      {c.name}
                    </Link>
                  </Td>
                  <Td>{c.phone}</Td>
                  <Td className="text-muted">{c.email || "—"}</Td>
                  <Td className="text-right">{c.order_count}</Td>
                  <Td className="text-right">{c.sip_count}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
