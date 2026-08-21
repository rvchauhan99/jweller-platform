"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ReactNode, useEffect, useState } from "react"
import { Button } from "@/components/ui"
import { logout, me } from "@/lib/api"

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [name, setName] = useState<string>("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    me()
      .then((u) => {
        setName(u.name || u.email)
        setReady(true)
      })
      .catch(() => router.replace("/login"))
  }, [router])

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted">Loading…</div>
    )
  }

  const handleLogout = async () => {
    await logout()
    router.replace("/login")
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/tenants" className="font-semibold text-text">
              Platform
            </Link>
            <nav className="flex gap-3 text-sm text-muted">
              <Link href="/tenants" className="hover:text-text">
                Tenants
              </Link>
              <Link href="/tenants/new" className="hover:text-text">
                Create tenant
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">{name}</span>
            <Button size="sm" variant="secondary" onClick={handleLogout} aria-label="Sign out">
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
