"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ReactNode, useEffect, useRef, useState } from "react"
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
  Menu,
  X,
  Gem,
  UserRound,
} from "lucide-react"
import { ApiError, logout, me, type MeResult } from "@/lib/api"
import { cn } from "@/lib/cn"
import { Skeleton } from "@/components/ui"

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

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<MeResult | null>(null)
  const [ready, setReady] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [])

  const handleSignOut = async () => {
    await logout()
    router.replace("/login")
  }

  const profileActive = pathname === "/profile" || pathname.startsWith("/profile/")

  /* ── Loading skeleton ─────────────────────────────────────────────────── */
  if (!ready || !user) {
    return (
      <div className="flex h-screen overflow-hidden bg-bg">
        <aside className="hidden h-full w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg md:flex">
          <div className="shrink-0 px-5 py-5 border-b border-sidebar-border">
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="shrink-0 border-t border-sidebar-border p-3">
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </aside>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-muted">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[13px]">Loading…</span>
          </div>
        </div>
      </div>
    )
  }

  /* ── Nav links (shared between desktop + mobile drawer) ───────────────── */
  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav
      className="flex flex-1 min-h-0 flex-col gap-0.5 overflow-y-auto px-3 py-2"
      aria-label="Main navigation"
    >
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
            onClick={onClick}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5",
              "text-[13.5px] font-medium transition-all duration-150",
              active
                ? "bg-sidebar-active-bg text-sidebar-active-text shadow-sm"
                : "text-sidebar-text hover:bg-sidebar-hover hover:text-text"
            )}
          >
            <Icon
              size={16}
              strokeWidth={active ? 2.2 : 1.8}
              aria-hidden
              className={cn(
                "shrink-0 transition-colors",
                active
                  ? "text-sidebar-active-text"
                  : "text-sidebar-muted group-hover:text-sidebar-text"
              )}
            />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const UserFooter = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="shrink-0 border-t border-sidebar-border p-3 space-y-1">
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text text-[11px] font-bold"
          aria-hidden
        >
          {initials(user.business_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-text">{user.username ?? user.role}</p>
          <p className="text-[10.5px] text-sidebar-muted">{user.two_fa_enabled ? "2FA on" : "Staff"}</p>
        </div>
      </div>
      <Link
        href="/profile"
        onClick={onNavigate}
        aria-label="Profile"
        aria-current={profileActive ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
          profileActive
            ? "bg-sidebar-active-bg text-sidebar-active-text"
            : "text-sidebar-text hover:bg-sidebar-hover hover:text-text"
        )}
      >
        <UserRound size={15} aria-hidden />
        Profile
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-muted hover:bg-sidebar-hover hover:text-danger transition-colors"
      >
        <LogOut size={15} aria-hidden />
        Sign out
      </button>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* ── Desktop sidebar (pinned; does not scroll with page) ──────────── */}
      <aside className="hidden h-full w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg md:flex">
        <div className="shrink-0 px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white text-[13px] font-bold shadow-sm">
              <Gem size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-text leading-tight">
                {user.business_name}
              </p>
              <p className="text-[11px] text-sidebar-muted">
                {user.tenant_code} · {user.role}
              </p>
            </div>
          </div>
        </div>

        <NavLinks />
        <UserFooter />
      </aside>

      {/* ── Content area (only this column scrolls) ─────────────────────── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-2.5 md:hidden"
          style={{ minHeight: "52px" }}
        >
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-alt hover:text-text transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-white">
              <Gem size={12} />
            </div>
            <p className="truncate text-[13px] font-semibold text-text">{user.business_name}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-alt hover:text-text transition-colors"
          >
            <LogOut size={16} />
          </button>
        </header>

        {mobileOpen ? (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div
              id="mobile-nav"
              ref={drawerRef}
              className="fixed inset-y-0 left-0 z-40 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar-bg shadow-xl md:hidden"
            >
              <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-sidebar-border">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
                    <Gem size={14} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-text">{user.business_name}</p>
                    <p className="text-[11px] text-sidebar-muted">
                      {user.tenant_code} · {user.role}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-text transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <NavLinks onClick={() => setMobileOpen(false)} />
              <UserFooter onNavigate={() => setMobileOpen(false)} />
            </div>
          </>
        ) : null}

        <main className="min-h-0 flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
      </div>
    </div>
  )
}
