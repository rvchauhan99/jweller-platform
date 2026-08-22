"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Gem } from "lucide-react"
import { ApiError, login } from "@/lib/api"
import { Button, Field, Input, AlertBar } from "@/components/ui"

export default function LoginPage() {
  const router = useRouter()
  const [tenantCode, setTenantCode] = useState("AURELIA")
  const [username, setUsername] = useState("owner")
  const [password, setPassword] = useState("")
  const [totp, setTotp] = useState("")
  const [needTotp, setNeedTotp] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const result = await login({
        tenant_code: tenantCode.trim(),
        username: username.trim(),
        password,
        totp: needTotp ? totp.trim() : undefined,
      })
      if ("two_fa_required" in result && result.two_fa_required) {
        setNeedTotp(true)
        return
      }
      router.replace("/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div
        className="hidden lg:flex lg:w-[460px] xl:w-[520px] shrink-0 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #5b21b6 0%, #7c3aed 40%, #a78bfa 100%)",
        }}
        aria-hidden="true"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Gem size={20} className="text-white" />
          </div>
          <span className="text-[16px] font-bold text-white tracking-tight">Jeweler Admin</span>
        </div>
        <div className="relative z-10">
          <p className="text-[34px] font-bold leading-[1.15] tracking-tight text-white">
            Your jewelry<br />business, elevated.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70 max-w-[320px]">
            Manage inventory, orders, SIP collections, POS billing, and customer relationships.
          </p>
        </div>
        <p className="relative z-10 text-[12px] text-white/50">Platform admin · not the storefront</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-bg">
        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-bold tracking-tight text-text">
              {needTotp ? "Authenticator" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-[14px] text-muted">
              {needTotp
                ? "Enter the 6-digit code from your authenticator app"
                : "Sign in with your tenant code and staff credentials"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {!needTotp ? (
              <>
                <Field label="Tenant code" htmlFor="tenant_code">
                  <Input
                    id="tenant_code"
                    name="tenant_code"
                    autoComplete="organization"
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value)}
                    required
                    aria-label="Tenant code"
                    placeholder="e.g. AURELIA"
                    className="h-10 text-[14px]"
                    style={{ textTransform: "uppercase" }}
                  />
                </Field>
                <Field label="Username" htmlFor="username">
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    aria-label="Username"
                    placeholder="owner, staff…"
                    className="h-10 text-[14px]"
                  />
                </Field>
                <Field label="Password" htmlFor="password">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-label="Password"
                    placeholder="••••••••"
                    className="h-10 text-[14px]"
                  />
                </Field>
              </>
            ) : (
              <Field label="Authenticator code" htmlFor="totp">
                <Input
                  id="totp"
                  name="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  aria-label="Authenticator code"
                  placeholder="123456"
                  className="h-10 text-[14px] tracking-widest"
                />
              </Field>
            )}

            {error ? <AlertBar variant="danger">{error}</AlertBar> : null}

            <Button type="submit" size="lg" className="w-full mt-3 h-11 text-[14px]" disabled={loading} aria-label="Sign in">
              {loading ? "Signing in…" : needTotp ? "Verify" : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px] text-muted">
            <Link href="/forgot-password" className="text-accent-text hover:underline">
              Forgot password?
            </Link>
            {needTotp ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="text-accent-text hover:underline"
                  onClick={() => {
                    setNeedTotp(false)
                    setTotp("")
                    setError("")
                  }}
                >
                  Back
                </button>
              </>
            ) : null}
          </p>

          {!needTotp ? (
            <div className="mt-8 rounded-lg border border-border bg-surface p-4 text-[12.5px] text-muted shadow-xs">
              <p className="font-semibold text-text mb-1.5">Demo credentials</p>
              <div className="flex gap-4">
                <div>
                  <span className="text-faint text-[11px] uppercase tracking-wide">Tenant</span>
                  <p className="font-mono text-text text-[12px]">AURELIA</p>
                </div>
                <div>
                  <span className="text-faint text-[11px] uppercase tracking-wide">User</span>
                  <p className="font-mono text-text text-[12px]">owner</p>
                </div>
                <div>
                  <span className="text-faint text-[11px] uppercase tracking-wide">Pass</span>
                  <p className="font-mono text-text text-[12px]">Aurelia@123</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
