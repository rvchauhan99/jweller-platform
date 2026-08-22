"use client"

import { FormEvent, useEffect, useState } from "react"
import { api, me, type MeResult } from "@/lib/api"
import { AlertBar, Button, Field, Input, PageHeader, Panel } from "@/components/ui"

interface Generate2fa {
  otpauth_url: string
  secret: string
  qr_png_data_url: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<MeResult | null>(null)
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwMsg, setPwMsg] = useState("")
  const [pwErr, setPwErr] = useState("")
  const [pwBusy, setPwBusy] = useState(false)

  const [totpBusy, setTotpBusy] = useState(false)
  const [totpErr, setTotpErr] = useState("")
  const [totpOk, setTotpOk] = useState("")
  const [setup, setSetup] = useState<Generate2fa | null>(null)
  const [totpCode, setTotpCode] = useState("")
  const [disableCode, setDisableCode] = useState("")

  const load = () => me().then(setUser).catch(() => setUser(null))

  useEffect(() => {
    load()
  }, [])

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwBusy(true)
    setPwErr("")
    setPwMsg("")
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { current_password: pwCurrent, new_password: pwNew },
      })
      setPwMsg("Password updated.")
      setPwCurrent("")
      setPwNew("")
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "Failed")
    } finally {
      setPwBusy(false)
    }
  }

  const handleGenerate = async () => {
    setTotpBusy(true)
    setTotpErr("")
    setTotpOk("")
    try {
      const data = await api<Generate2fa>("/auth/2fa/generate", { method: "POST", body: {} })
      setSetup(data)
    } catch (err) {
      setTotpErr(err instanceof Error ? err.message : "Failed")
    } finally {
      setTotpBusy(false)
    }
  }

  const handleEnable = async (e: FormEvent) => {
    e.preventDefault()
    setTotpBusy(true)
    setTotpErr("")
    try {
      await api("/auth/2fa/enable", { method: "POST", body: { totp: totpCode } })
      setTotpOk("Authenticator enabled. You’ll need it on the next sign-in.")
      setSetup(null)
      setTotpCode("")
      await load()
    } catch (err) {
      setTotpErr(err instanceof Error ? err.message : "Failed")
    } finally {
      setTotpBusy(false)
    }
  }

  const handleDisable = async (e: FormEvent) => {
    e.preventDefault()
    setTotpBusy(true)
    setTotpErr("")
    try {
      await api("/auth/2fa/disable", { method: "POST", body: { totp: disableCode } })
      setTotpOk("Authenticator disabled.")
      setDisableCode("")
      await load()
    } catch (err) {
      setTotpErr(err instanceof Error ? err.message : "Failed")
    } finally {
      setTotpBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle={
          user
            ? `${user.username ?? "staff"} · ${user.tenant_code}${user.phone_masked ? ` · ${user.phone_masked}` : ""}`
            : "Account security"
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="px-4 pt-4 text-[14px] font-semibold text-text">Change password</h2>
          <form onSubmit={handleChangePassword} className="space-y-3 p-4">
            <Field label="Current password" htmlFor="current_password">
              <Input
                id="current_password"
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password" htmlFor="new_password">
              <Input
                id="new_password"
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            {pwErr ? <AlertBar variant="danger">{pwErr}</AlertBar> : null}
            {pwMsg ? <AlertBar variant="success">{pwMsg}</AlertBar> : null}
            <Button type="submit" disabled={pwBusy}>
              {pwBusy ? "Saving…" : "Update password"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <h2 className="px-4 pt-4 text-[14px] font-semibold text-text">Authenticator (optional)</h2>
          <div className="space-y-3 p-4">
            <p className="text-[13px] text-muted">
              Use Google Authenticator / Authy. When enabled, login asks for a 6-digit code after your password.
            </p>
            {totpErr ? <AlertBar variant="danger">{totpErr}</AlertBar> : null}
            {totpOk ? <AlertBar variant="success">{totpOk}</AlertBar> : null}

            {user?.two_fa_enabled ? (
              <form onSubmit={handleDisable} className="space-y-3">
                <AlertBar variant="info">Authenticator is on for this account.</AlertBar>
                <Field label="Code to disable" htmlFor="disable_totp">
                  <Input
                    id="disable_totp"
                    inputMode="numeric"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    placeholder="123456"
                  />
                </Field>
                <Button type="submit" variant="danger" disabled={totpBusy || disableCode.length < 6}>
                  Disable authenticator
                </Button>
              </form>
            ) : (
              <>
                {!setup ? (
                  <Button type="button" onClick={handleGenerate} disabled={totpBusy}>
                    {totpBusy ? "…" : "Set up authenticator"}
                  </Button>
                ) : (
                  <form onSubmit={handleEnable} className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={setup.qr_png_data_url}
                      alt="Authenticator QR code"
                      className="h-40 w-40 rounded border border-border bg-white p-2"
                    />
                    <p className="break-all font-mono text-[11px] text-muted">Secret: {setup.secret}</p>
                    <Field label="Confirm code" htmlFor="enable_totp">
                      <Input
                        id="enable_totp"
                        inputMode="numeric"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        placeholder="123456"
                      />
                    </Field>
                    <Button type="submit" disabled={totpBusy || totpCode.length < 6}>
                      Enable
                    </Button>
                  </form>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
