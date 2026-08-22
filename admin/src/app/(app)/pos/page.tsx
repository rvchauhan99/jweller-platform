"use client"

import { FormEvent, useEffect, useState } from "react"
import { CheckCircle, Minus, Package, Plus, Search, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import {
  AlertBar,
  Button,
  Empty,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  SectionHeading,
  StatusDot,
} from "@/components/ui"

interface Product {
  id: string
  name: string
  stock_qty: number
  live_price?: number
  price?: number
  weight_grams?: number
  sku?: string
}

interface CartLine {
  product_id: string
  name: string
  qty: number
  unit_price: number
  stock_qty: number
}

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [tender, setTender] = useState<"cash" | "upi" | "card">("cash")
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [q, setQ] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState("")
  const [error, setError] = useState("")

  const loadProducts = () =>
    api<Product[]>("/products")
      .then(setProducts)
      .catch((e) => setError(e.message))

  useEffect(() => {
    loadProducts()
  }, [])

  const filtered = products.filter((p) => {
    if (!q.trim()) return true
    const needle = q.toLowerCase()
    return (
      p.name.toLowerCase().includes(needle) ||
      (p.sku || "").toLowerCase().includes(needle)
    )
  })

  const handleAdd = (p: Product) => {
    if (p.stock_qty < 1) return
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === p.id)
      if (existing) {
        if (existing.qty >= p.stock_qty) return prev
        return prev.map((l) =>
          l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l
        )
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          qty: 1,
          unit_price: p.live_price ?? p.price ?? 0,
          stock_qty: p.stock_qty,
        },
      ]
    })
    setSuccessNo("")
    setError("")
  }

  const handleQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product_id !== productId) return l
          const next = Math.max(0, Math.min(l.qty + delta, l.stock_qty))
          return { ...l, qty: next }
        })
        .filter((l) => l.qty > 0)
    )
  }

  const handleRemove = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.product_id !== productId))
  }

  const total = cart.reduce((sum, l) => sum + l.unit_price * l.qty, 0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!cart.length) {
      setError("Add at least one product")
      return
    }
    setSubmitting(true)
    setError("")
    setSuccessNo("")
    try {
      const order = await api<{ order_no: string }>("/pos/sale", {
        method: "POST",
        body: {
          items: cart.map((l) => ({
            product_id: l.product_id,
            qty: l.qty,
            unit_price: l.unit_price,
          })),
          tender,
          contact_name: contactName.trim() || "Walk-in",
          contact_phone: contactPhone.trim() || undefined,
          lock_rate: true,
        },
      })
      setSuccessNo(order.order_no)
      setCart([])
      setContactName("")
      setContactPhone("")
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sale failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="POS" subtitle="Walk-in sale · cash / UPI / card" />
      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── Product picker ──────────────────────────────────────────── */}
        <Panel className="lg:col-span-3 flex flex-col" style={{ maxHeight: "calc(100vh - 160px)" }}>
          {/* Search bar */}
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                aria-hidden
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or SKU…"
                aria-label="Search products"
                className="pl-8"
              />
            </div>
          </div>

          {/* Product list */}
          <ul
            className="flex-1 divide-y divide-border overflow-y-auto"
            role="list"
            aria-label="Products"
          >
            {filtered.length === 0 ? (
              <li>
                <Empty
                  icon={<Package size={22} />}
                  title="No products found"
                  description={q ? `No match for "${q}"` : "No products in inventory."}
                />
              </li>
            ) : (
              filtered.map((p) => {
                const inStock = p.stock_qty > 0
                const inCart = cart.find((l) => l.product_id === p.id)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleAdd(p)}
                      disabled={!inStock}
                      aria-label={`Add ${p.name} to cart`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Stock indicator */}
                        <StatusDot
                          variant={
                            p.stock_qty === 0
                              ? "danger"
                              : p.stock_qty <= 2
                              ? "warning"
                              : "success"
                          }
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-text">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-muted">
                            {p.sku ? `${p.sku} · ` : ""}
                            {inStock ? `${p.stock_qty} in stock` : "Out of stock"}
                            {inCart ? ` · ${inCart.qty} in cart` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[13px] font-semibold tabular-nums text-text">
                          {money(p.live_price ?? p.price ?? 0)}
                        </div>
                        {p.weight_grams ? (
                          <div className="text-[11px] text-muted">{p.weight_grams}g</div>
                        ) : null}
                      </div>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </Panel>

        {/* ── Cart + checkout ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Cart */}
          <Panel className="p-4">
            <SectionHeading>Cart</SectionHeading>
            {!cart.length ? (
              <p className="py-4 text-center text-[12.5px] text-muted">
                Pick products from the list.
              </p>
            ) : (
              <ul className="space-y-2" role="list">
                {cart.map((l) => (
                  <li
                    key={l.product_id}
                    className="flex items-center gap-2"
                  >
                    {/* Name + unit price */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-text">
                        {l.name}
                      </div>
                      <div className="text-[11px] text-muted">
                        {money(l.unit_price)} each
                      </div>
                    </div>
                    {/* Qty stepper */}
                    <div className="flex items-center gap-1 rounded-md border border-border overflow-hidden shrink-0">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center text-muted hover:bg-surface-alt hover:text-text transition-colors disabled:opacity-40"
                        onClick={() => handleQty(l.product_id, -1)}
                        disabled={l.qty <= 1}
                        aria-label={`Decrease quantity of ${l.name}`}
                      >
                        <Minus size={11} aria-hidden />
                      </button>
                      <span className="w-6 text-center text-[12.5px] font-semibold tabular-nums">
                        {l.qty}
                      </span>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center text-muted hover:bg-surface-alt hover:text-text transition-colors disabled:opacity-40"
                        onClick={() => handleQty(l.product_id, 1)}
                        disabled={l.qty >= l.stock_qty}
                        aria-label={`Increase quantity of ${l.name}`}
                      >
                        <Plus size={11} aria-hidden />
                      </button>
                    </div>
                    {/* Line total */}
                    <div className="w-20 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                      {money(l.unit_price * l.qty)}
                    </div>
                    {/* Remove */}
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted hover:bg-danger-soft hover:text-danger transition-colors"
                      onClick={() => handleRemove(l.product_id)}
                      aria-label={`Remove ${l.name} from cart`}
                    >
                      <Trash2 size={12} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Total row */}
            {cart.length > 0 ? (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Total
                </span>
                <span className="text-[20px] font-bold tabular-nums text-text">
                  {money(total)}
                </span>
              </div>
            ) : null}
          </Panel>

          {/* Checkout form */}
          <Panel className="p-4">
            <SectionHeading>Checkout</SectionHeading>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Tender" htmlFor="tender">
                <Select
                  id="tender"
                  value={tender}
                  onChange={(e) => setTender(e.target.value as "cash" | "upi" | "card")}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                </Select>
              </Field>
              <Field label="Contact name (optional)" htmlFor="contact_name">
                <Input
                  id="contact_name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Walk-in"
                />
              </Field>
              <Field label="Phone (optional)" htmlFor="contact_phone">
                <Input
                  id="contact_phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="10-digit"
                />
              </Field>

              {error ? <AlertBar variant="danger">{error}</AlertBar> : null}

              {successNo ? (
                <div className="flex items-center gap-2.5 rounded-md border border-[color:var(--success)] bg-success-soft px-4 py-3">
                  <CheckCircle size={16} className="text-success shrink-0" aria-hidden />
                  <div>
                    <p className="text-[13px] font-semibold text-success">
                      Sale recorded!
                    </p>
                    <p className="text-[11.5px] text-success opacity-80">{successNo}</p>
                  </div>
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting || !cart.length}
                aria-label="Complete sale"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Recording…
                  </span>
                ) : (
                  `Complete sale${total > 0 ? ` · ${money(total)}` : ""}`
                )}
              </Button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  )
}
