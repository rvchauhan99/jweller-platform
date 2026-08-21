"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Label, Select } from "@/components/ui"
import { api } from "@/lib/api"

const PRESETS = ["classic-gold", "modern-minimal", "royal", "high-contrast"] as const

export default function CreateTenantPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    business_name: "",
    tenant_code: "",
    subdomain: "",
    plan: "basic",
    preset_id: "classic-gold",
    owner_username: "owner",
    owner_password: "",
    tagline: "",
  })

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ tenant_id: string }>("/tenants", {
        method: "POST",
        body: {
          business_name: form.business_name,
          tenant_code: form.tenant_code,
          subdomain: form.subdomain,
          plan: form.plan,
          theme: { preset_id: form.preset_id },
          owner_username: form.owner_username,
          owner_password: form.owner_password,
          tagline: form.tagline || undefined,
        },
      })
      router.replace(`/tenants/${res.tenant_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Create tenant</h1>
        <p className="text-sm text-muted">Business → site → theme → owner → provision (in-process, no Redis).</p>
      </div>
      <ol className="flex flex-wrap gap-2 text-xs text-muted">
        {["Business", "Site", "Theme", "Owner", "Confirm"].map((label, i) => (
          <li key={label} className={i === step ? "font-semibold text-text" : ""}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-border bg-surface p-5">
        {step === 0 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="business_name">Business name</Label>
              <Input id="business_name" value={form.business_name} onChange={(e) => update("business_name", e.target.value)} required aria-label="Business name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan">Plan</Label>
              <Select id="plan" value={form.plan} onChange={(e) => update("plan", e.target.value)} aria-label="Plan">
                <option value="basic">basic</option>
                <option value="pro">pro</option>
                <option value="enterprise">enterprise</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" value={form.tagline} onChange={(e) => update("tagline", e.target.value)} aria-label="Tagline" />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="tenant_code">Tenant code</Label>
              <Input id="tenant_code" value={form.tenant_code} onChange={(e) => update("tenant_code", e.target.value.toUpperCase())} required aria-label="Tenant code" />
              <p className="text-xs text-muted">3–12 chars A–Z / 0–9</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input id="subdomain" value={form.subdomain} onChange={(e) => update("subdomain", e.target.value.toLowerCase())} required aria-label="Subdomain" />
              <p className="text-xs text-muted">Host: {form.subdomain || "…"}.luxejewel.app</p>
            </div>
          </>
        )}
        {step === 2 && (
          <div className="space-y-1.5">
            <Label htmlFor="preset">Theme preset</Label>
            <Select id="preset" value={form.preset_id} onChange={(e) => update("preset_id", e.target.value)} aria-label="Theme preset">
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        )}
        {step === 3 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="owner_username">Owner username</Label>
              <Input id="owner_username" value={form.owner_username} onChange={(e) => update("owner_username", e.target.value)} required aria-label="Owner username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner_password">Owner password</Label>
              <Input id="owner_password" type="password" value={form.owner_password} onChange={(e) => update("owner_password", e.target.value)} required minLength={8} aria-label="Owner password" />
            </div>
          </>
        )}
        {step === 4 && (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted">Business:</span> {form.business_name}
            </p>
            <p>
              <span className="text-muted">Code / host:</span> {form.tenant_code} · {form.subdomain}.luxejewel.app
            </p>
            <p>
              <span className="text-muted">Theme:</span> {form.preset_id}
            </p>
            <p>
              <span className="text-muted">Owner:</span> {form.owner_username}
            </p>
          </div>
        )}

        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}

        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="secondary" disabled={step === 0 || loading} onClick={() => setStep((s) => s - 1)} aria-label="Back">
            Back
          </Button>
          {step < 4 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)} aria-label="Next">
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={loading} aria-label="Provision tenant">
              {loading ? "Provisioning…" : "Provision tenant"}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
