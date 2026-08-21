"use client"

import { FormEvent, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { COLOR_FIELDS, PRESET_IDS, PRESETS, type ThemeColors, type ThemeFonts } from "@/lib/presets"
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui"

interface ThemeState {
  preset_id: string
  mode: "light" | "dark"
  colors: ThemeColors
  fonts: ThemeFonts
}

const normalize = (t: Partial<ThemeState> | null): ThemeState => {
  const id = t?.preset_id && PRESETS[t.preset_id] ? t.preset_id : "classic-gold"
  const base = PRESETS[id]
  return {
    preset_id: id,
    mode: t?.mode || base.mode,
    colors: { ...base.colors, ...(t?.colors || {}) },
    fonts: { ...base.fonts, ...(t?.fonts || {}) },
  }
}

export default function BrandingPage() {
  const [theme, setTheme] = useState<ThemeState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    api<Partial<ThemeState>>("/theme")
      .then((t) => setTheme(normalize(t)))
      .catch((e) => setError(e.message || "Failed to load theme"))
  }, [])

  const handleApplyPreset = (id: string) => {
    const p = PRESETS[id]
    if (!p) return
    setTheme({
      preset_id: id,
      mode: p.mode,
      colors: { ...p.colors },
      fonts: { ...p.fonts },
    })
    setSaved(false)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!theme) return
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      await api("/theme", {
        method: "PUT",
        body: {
          preset_id: theme.preset_id,
          mode: theme.mode,
          colors: theme.colors,
          fonts: theme.fonts,
        },
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!theme && !error) return <p className="text-sm text-muted">Loading…</p>
  if (!theme) return <p className="text-sm text-danger">{error}</p>

  return (
    <div>
      <PageHeader title="Branding" subtitle="Storefront theme tokens (customer app)" />
      <form onSubmit={handleSave} className="space-y-5">
        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Presets</h2>
          <div className="flex flex-wrap gap-2">
            {PRESET_IDS.map((id) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={theme.preset_id === id ? "accent" : "secondary"}
                onClick={() => handleApplyPreset(id)}
                aria-label={`Apply ${id} preset`}
                aria-pressed={theme.preset_id === id}
              >
                {id}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Colors</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COLOR_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={f.key}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label={`${f.label} color picker`}
                    className="h-9 w-10 cursor-pointer rounded border border-border bg-surface"
                    value={theme.colors[f.key] || "#000000"}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        colors: { ...theme.colors, [f.key]: e.target.value },
                      })
                    }
                  />
                  <Input
                    id={f.key}
                    value={theme.colors[f.key] || ""}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        colors: { ...theme.colors, [f.key]: e.target.value },
                      })
                    }
                    aria-label={f.label}
                  />
                </div>
              </Field>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Fonts</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Heading" htmlFor="heading-font">
              <Select
                id="heading-font"
                value={theme.fonts.heading}
                onChange={(e) =>
                  setTheme({ ...theme, fonts: { ...theme.fonts, heading: e.target.value } })
                }
              >
                {["Cormorant Garamond", "Playfair Display", "Source Serif 4", "DM Sans", "Inter"].map(
                  (f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  )
                )}
              </Select>
            </Field>
            <Field label="Body" htmlFor="body-font">
              <Select
                id="body-font"
                value={theme.fonts.body}
                onChange={(e) =>
                  setTheme({ ...theme, fonts: { ...theme.fonts, body: e.target.value } })
                }
              >
                {["DM Sans", "Inter", "Cormorant Garamond", "Playfair Display", "Source Serif 4"].map(
                  (f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  )
                )}
              </Select>
            </Field>
          </div>
        </Panel>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? <p className="text-sm text-success">Theme saved.</p> : null}

        <Button type="submit" disabled={saving} aria-label="Save branding">
          {saving ? "Saving…" : "Save theme"}
        </Button>
      </form>
    </div>
  )
}
