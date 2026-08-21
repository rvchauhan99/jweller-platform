"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ReactNode, useEffect, useState } from "react"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Coins,
  Truck,
  BarChart3,
  Palette,
  UserCog,
  Settings,
  LogOut,
  Store,
} from "lucide-react"
import { ApiError, logout, me, type MeResult } from "@/lib/api"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: Store },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/sip", label: "Gold SIP", icon: Coins },
  { href: "/purchases", label: "Purchases", icon: Truck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/branding", label: "Branding", icon: Palette },
  { href: "/staff", label: "Staff", icon: UserCog },
  { href: "/settings", label: "Settings", icon: Settings },
]

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<MeResult | null>(null)
  const [ready, setReady] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    me()
      .then((u) => {
        if (!cancelled) {
          setUser(u)
          setReady(true)
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login")
          return
        }
        router.replace("/login")
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const handleSignOut = async () => {
    await logout()
    router.replace("/login")
  }

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">
        Loading…
      </div>
    )
  }

  const NavLinks = () => (
    <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
      {NAV.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            tabIndex={0}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-alt hover:text-text"
            )}
          >
            <Icon size={16} aria-hidden />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="border-b border-border px-4 py-4">
          <p className="truncate text-sm font-semibold text-text">{user.business_name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {user.tenant_code} · {user.role}
          </p>
        </div>
        <NavLinks />
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <LogOut size={16} aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 md:hidden">
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-sm font-medium text-text hover:bg-surface-alt"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            Menu
          </button>
          <p className="truncate text-sm font-semibold">{user.business_name}</p>
          <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sign out">
            <LogOut size={16} />
          </Button>
        </header>

        {mobileOpen ? (
          <div className="border-b border-border bg-surface md:hidden">
            <NavLinks />
          </div>
        ) : null}

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
