"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Label } from "@/components/ui"
import { login } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("ops@luxejewel.app")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      router.replace("/tenants")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6"
        aria-label="Platform login"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">LuxeJewel</p>
          <h1 className="mt-1 text-xl font-semibold text-text">Platform console</h1>
          <p className="mt-1 text-sm text-muted">Operator access — create and suspend tenants.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="Password"
          />
        </div>
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading} aria-label="Sign in">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  )
}
