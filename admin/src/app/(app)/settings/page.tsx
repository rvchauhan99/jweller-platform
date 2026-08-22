"use client"

import { FormEvent, useEffect, useState } from "react"
import { api, me } from "@/lib/api"
import { Button, Field, Input, PageHeader, Panel, Textarea } from "@/components/ui"

interface Settings {
  business_name: string
  tenant_code: string
  subdomain?: string
  rate_margins?: {
    gold_pct?: number
    silver_pct?: number
    gold_inr_per_g?: number
    silver_inr_per_g?: number
  }
  rate_city?: string | null
  rate_state?: string | null
  rates_preview?: {
    gold: { base_inr_per_gram: number; inr_per_gram: number }
    silver: { base_inr_per_gram: number; inr_per_gram: number }
  } | null
  gstin?: string
  invoice_prefix?: string
}

interface Cms {
  hero_title?: string
  hero_subtitle?: string
  hero_image?: string
  about_title?: string
  about_text?: string
}

interface Gateway {
  provider: string
  key_id?: string | null
  key_secret_set?: boolean
  webhook_secret_set?: boolean
  enabled: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [cms, setCms] = useState<Cms>({})
  const [gateway, setGateway] = useState<Gateway | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [keySecret, setKeySecret] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      api<Settings>("/settings"),
      api<Cms>("/cms"),
      me(),
    ])
      .then(async ([s, c, u]) => {
        setSettings(s)
        setCms(c || {})
        setIsOwner(u.role === "owner")
        if (u.role === "owner") {
          try {
            setGateway(await api<Gateway>("/gateway"))
          } catch {
            setGateway(null)
          }
        }
      })
      .catch((e) => setError(e.message || "Failed to load"))
  }, [])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    setMessage("")
    setError("")
    try {
      await api("/settings", {
        method: "PUT",
        body: {
          business_name: settings.business_name,
          gstin: settings.gstin,
          invoice_prefix: settings.invoice_prefix,
          rate_margins: settings.rate_margins,
          rate_city: settings.rate_city || null,
          rate_state: settings.rate_state || null,
        },
      })
      await api("/cms", {
        method: "PUT",
        body: cms,
      })
      if (isOwner && gateway) {
        await api("/gateway", {
          method: "PUT",
          body: {
            provider: gateway.provider || "razorpay",
            key_id: gateway.key_id,
            key_secret: keySecret || undefined,
            webhook_secret: webhookSecret || undefined,
            enabled: gateway.enabled,
          },
        })
        setKeySecret("")
        setWebhookSecret("")
        setGateway(await api<Gateway>("/gateway"))
      }
      setMessage("Settings saved.")
      setSettings(await api<Settings>("/settings"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!settings && !error) return <p className="text-sm text-muted">Loading…</p>
  if (!settings) return <p className="text-sm text-danger">{error}</p>

  return (
    <div>
      <PageHeader title="Settings" subtitle="Business, margins, CMS, and gateway" />
      <form onSubmit={handleSave} className="space-y-5">
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Business</h2>
          <Field label="Business name" htmlFor="business_name">
            <Input
              id="business_name"
              value={settings.business_name || ""}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="GSTIN" htmlFor="gstin">
              <Input
                id="gstin"
                value={settings.gstin || ""}
                onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
              />
            </Field>
            <Field label="Invoice prefix" htmlFor="invoice_prefix">
              <Input
                id="invoice_prefix"
                value={settings.invoice_prefix || ""}
                onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-xs text-muted">
            Tenant {settings.tenant_code}
            {settings.subdomain ? ` · ${settings.subdomain}` : ""}
          </p>
        </Panel>

        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Rate margins (shop board)</h2>
          <p className="text-xs text-muted">
            Sell = international spot (INR/g) × (1 + %) + absolute ₹/g city premium. Use +₹/g to match your local board.
          </p>
          {settings.rates_preview ? (
            <div
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-muted"
              aria-label="Live rate preview"
            >
              <p className="font-medium text-text">
                Live preview{settings.rate_city ? ` · ${settings.rate_city}` : ""}
              </p>
              <p className="mt-1">
                Gold base ₹{settings.rates_preview.gold.base_inr_per_gram}/g → sell ₹
                {Math.round(
                  (settings.rates_preview.gold.base_inr_per_gram *
                    (1 + (settings.rate_margins?.gold_pct ?? 0) / 100) +
                    (settings.rate_margins?.gold_inr_per_g ?? 0)) *
                    100
                ) / 100}
                /g
              </p>
              <p className="mt-1">
                Silver base ₹{settings.rates_preview.silver.base_inr_per_gram}/g → sell ₹
                {Math.round(
                  (settings.rates_preview.silver.base_inr_per_gram *
                    (1 + (settings.rate_margins?.silver_pct ?? 0) / 100) +
                    (settings.rate_margins?.silver_inr_per_g ?? 0)) *
                    100
                ) / 100}
                /g
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gold %" htmlFor="gold_pct">
              <Input
                id="gold_pct"
                type="number"
                step="0.01"
                value={settings.rate_margins?.gold_pct ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rate_margins: {
                      ...settings.rate_margins,
                      gold_pct: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="Gold +₹/g" htmlFor="gold_inr_per_g">
              <Input
                id="gold_inr_per_g"
                type="number"
                step="0.01"
                value={settings.rate_margins?.gold_inr_per_g ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rate_margins: {
                      ...settings.rate_margins,
                      gold_inr_per_g: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="Silver %" htmlFor="silver_pct">
              <Input
                id="silver_pct"
                type="number"
                step="0.01"
                value={settings.rate_margins?.silver_pct ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rate_margins: {
                      ...settings.rate_margins,
                      silver_pct: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="Silver +₹/g" htmlFor="silver_inr_per_g">
              <Input
                id="silver_inr_per_g"
                type="number"
                step="0.01"
                value={settings.rate_margins?.silver_inr_per_g ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rate_margins: {
                      ...settings.rate_margins,
                      silver_inr_per_g: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="Rate city" htmlFor="rate_city">
              <Input
                id="rate_city"
                value={settings.rate_city || ""}
                onChange={(e) => setSettings({ ...settings, rate_city: e.target.value })}
              />
            </Field>
            <Field label="Rate state" htmlFor="rate_state">
              <Input
                id="rate_state"
                value={settings.rate_state || ""}
                onChange={(e) => setSettings({ ...settings, rate_state: e.target.value })}
              />
            </Field>
          </div>
        </Panel>

        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">CMS</h2>
          <Field label="Hero title" htmlFor="hero_title">
            <Input
              id="hero_title"
              value={cms.hero_title || ""}
              onChange={(e) => setCms({ ...cms, hero_title: e.target.value })}
            />
          </Field>
          <Field label="Hero subtitle" htmlFor="hero_subtitle">
            <Input
              id="hero_subtitle"
              value={cms.hero_subtitle || ""}
              onChange={(e) => setCms({ ...cms, hero_subtitle: e.target.value })}
            />
          </Field>
          <Field label="Hero image URL" htmlFor="hero_image">
            <Input
              id="hero_image"
              value={cms.hero_image || ""}
              onChange={(e) => setCms({ ...cms, hero_image: e.target.value })}
            />
          </Field>
          <Field label="About title" htmlFor="about_title">
            <Input
              id="about_title"
              value={cms.about_title || ""}
              onChange={(e) => setCms({ ...cms, about_title: e.target.value })}
            />
          </Field>
          <Field label="About text" htmlFor="about_text">
            <Textarea
              id="about_text"
              value={cms.about_text || ""}
              onChange={(e) => setCms({ ...cms, about_text: e.target.value })}
            />
          </Field>
        </Panel>

        {isOwner ? (
          <Panel className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Payment gateway (owner)</h2>
            <p className="text-xs text-[var(--muted)]">
              Razorpay Model B. Webhook URL: {"{API}"}/api/public/webhooks/razorpay
            </p>
            <Field label="Key ID" htmlFor="key_id">
              <Input
                id="key_id"
                value={gateway?.key_id || ""}
                onChange={(e) =>
                  setGateway({ ...(gateway || { provider: "razorpay", enabled: false }), key_id: e.target.value })
                }
              />
            </Field>
            <Field
              label={gateway?.key_secret_set ? "Key secret (blank = keep)" : "Key secret"}
              htmlFor="key_secret"
            >
              <Input
                id="key_secret"
                type="password"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field
              label={gateway?.webhook_secret_set ? "Webhook secret (blank = keep)" : "Webhook secret"}
              htmlFor="webhook_secret"
            >
              <Input
                id="webhook_secret"
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!gateway?.enabled}
                onChange={(e) =>
                  setGateway({
                    ...(gateway || { provider: "razorpay", enabled: false }),
                    enabled: e.target.checked,
                  })
                }
              />
              Gateway enabled
            </label>
          </Panel>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-success">{message}</p> : null}

        <Button type="submit" disabled={saving} aria-label="Save settings">
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </div>
  )
}
