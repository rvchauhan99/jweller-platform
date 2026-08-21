"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Table, Td, Th } from "@/components/ui"
import { api, TenantRow } from "@/lib/api"

export default function TenantsPage() {
  const [rows, setRows] = useState<TenantRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<TenantRow[]>("/tenants")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">Tenants</h1>
          <p className="text-sm text-muted">Registry status and primary host. No vanity KPIs.</p>
        </div>
        <Link
          href="/tenants/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary/90"
        >
          Create tenant
        </Link>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Business</Th>
              <Th>Status</Th>
              <Th>Plan</Th>
              <Th>Primary host</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <Td className="font-medium">{t.tenant_code}</Td>
                <Td>{t.business_name}</Td>
                <Td className="capitalize">{t.status}</Td>
                <Td className="capitalize">{t.plan || "—"}</Td>
                <Td className="text-muted">{t.primary_hostname || "—"}</Td>
                <Td className="text-right">
                  <Link href={`/tenants/${t.id}`} className="text-sm text-accent hover:underline">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}
