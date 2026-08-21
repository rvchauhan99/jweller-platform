"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button, Input, Label, Select, Table, Td, Th } from "@/components/ui"
import { api } from "@/lib/api"

interface Site {
  hostname: string
  kind?: string
  status?: string
  is_primary?: boolean
}

interface TenantDetail {
  id: string
  tenant_code: string
  business_name: string
  status: string
  plan?: string
  subdomain?: string
  sites?: Site[]
  job?: { status?: string; step?: string; error_log?: string }
}

export default function TenantDetailPage() {
  const params = useParams()
  const id = String(params.id || "")
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [host, setHost] = useState("")
  const [kind, setKind] = useState("custom")

  const load = useCallback(async () => {
    try {
      setTenant(await api<TenantDetail>(`/tenants/${id}`))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleSuspend = async () => {
    await api(`/tenants/${id}/suspend`, { method: "POST", body: { reason: "operator" } })
    await load()
  }

  const handleActivate = async () => {
    await api(`/tenants/${id}/activate`, { method: "POST" })
    await load()
  }

  const handleAddSite = async (e: FormEvent) => {
    e.preventDefault()
    await api(`/tenants/${id}/sites`, { method: "POST", body: { hostname: host, kind, is_primary: false } })
    setHost("")
    await load()
  }

  if (!tenant && !error) return <p className="text-sm text-muted">Loading…</p>
  if (error) return <p className="text-sm text-danger">{error}</p>
  if (!tenant) return null

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{tenant.business_name}</h1>
          <p className="text-sm text-muted">
            {tenant.tenant_code} · <span className="capitalize">{tenant.status}</span> · {tenant.plan || "basic"}
          </p>
          {tenant.job ? (
            <p className="mt-1 text-xs text-muted">
              Job: {tenant.job.status} / {tenant.job.step}
              {tenant.job.error_log ? ` — ${tenant.job.error_log}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {tenant.status === "active" ? (
            <Button variant="danger" onClick={handleSuspend} aria-label="Suspend tenant">
              Suspend
            </Button>
          ) : (
            <Button variant="accent" onClick={handleActivate} aria-label="Activate tenant">
              Activate
            </Button>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Domains</h2>
        <p className="text-sm text-muted">DNS verification is not required this wave. Custom hosts stay pending_dns.</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <Table>
          <thead>
            <tr>
              <Th>Hostname</Th>
              <Th>Kind</Th>
              <Th>Status</Th>
              <Th>Primary</Th>
            </tr>
          </thead>
          <tbody>
            {(tenant.sites || []).map((s) => (
              <tr key={s.hostname}>
                <Td>{s.hostname}</Td>
                <Td>{s.kind || "—"}</Td>
                <Td>{s.status || "—"}</Td>
                <Td>{s.is_primary ? "yes" : ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        </div>
        <form onSubmit={handleAddSite} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor="hostname">Add hostname</Label>
            <Input id="hostname" value={host} onChange={(e) => setHost(e.target.value)} required placeholder="shop.example.com" aria-label="Hostname" />
          </div>
          <div className="w-36 space-y-1.5">
            <Label htmlFor="kind">Kind</Label>
            <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Site kind">
              <option value="custom">custom</option>
              <option value="subdomain">subdomain</option>
              <option value="preview">preview</option>
            </Select>
          </div>
          <Button type="submit" aria-label="Add domain">
            Add
          </Button>
        </form>
      </section>
    </div>
  )
}
