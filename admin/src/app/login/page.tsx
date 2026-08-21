"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { ApiError, login } from "@/lib/api"
import { Button, Field, Input, Panel } from "@/components/ui"

export default function LoginPage() {
  const router = useRouter()
  const [tenantCode, setTenantCode] = useState("AURELIA")
  const [username, setUsername] = useState("owner")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login({
        tenant_code: tenantCode.trim(),
        username: username.trim(),
        password,
      })
      router.replace("/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Panel className="w-full max-w-sm p-6">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Jeweler Admin</p>
          <h1 className="mt-1 text-xl font-semibold text-text">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Tenant code + staff credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Tenant code" htmlFor="tenant_code">
            <Input
              id="tenant_code"
              name="tenant_code"
              autoComplete="organization"
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value)}
              required
              aria-label="Tenant code"
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
            />
          </Field>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading} aria-label="Sign in">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-muted">
          Demo: <span className="font-medium text-text">AURELIA</span> / owner / Aurelia@123
        </p>
      </Panel>
    </div>
  )
}
