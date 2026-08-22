"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ApiError, forgotConfirm, forgotRequest } from "@/lib/api"
import { AlertBar, Button, Field, Input } from "@/components/ui"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [tenantCode, setTenantCode] = useState("AURELIA")
  const [username, setUsername] = useState("owner")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [hint, setHint] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await forgotRequest({
        tenant_code: tenantCode.trim(),
        username: username.trim(),
      })
      setHint(res.dev_hint || res.message || "OTP sent if the account has a phone on file.")
      setStep(2)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await forgotConfirm({
        tenant_code: tenantCode.trim(),
        username: username.trim(),
        code: code.trim(),
        new_password: newPassword,
      })
      router.replace("/login")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[24px] font-bold tracking-tight text-text">Forgot password</h1>
        <p className="mt-1.5 text-[14px] text-muted">
          {step === 1
            ? "We’ll SMS a one-time code to the phone on your staff account."
            : "Enter the OTP and choose a new password (min 8, letter + digit)."}
        </p>

        {step === 1 ? (
          <form onSubmit={handleRequest} className="mt-6 space-y-4">
            <Field label="Tenant code" htmlFor="tenant_code">
              <Input
                id="tenant_code"
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value)}
                required
                style={{ textTransform: "uppercase" }}
              />
            </Field>
            <Field label="Username" htmlFor="username">
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </Field>
            {error ? <AlertBar variant="danger">{error}</AlertBar> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="mt-6 space-y-4">
            {hint ? <AlertBar variant="info">{hint}</AlertBar> : null}
            <Field label="OTP code" htmlFor="code">
              <Input
                id="code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                placeholder="123456"
              />
            </Field>
            <Field label="New password" htmlFor="new_password">
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>
            {error ? <AlertBar variant="danger">{error}</AlertBar> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Reset password"}
            </Button>
            <button type="button" className="text-[13px] text-accent-text" onClick={() => setStep(1)}>
              Resend / change account
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[13px] text-muted">
          <Link href="/login" className="text-accent-text hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
