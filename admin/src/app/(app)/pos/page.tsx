"use client"

import { FormEvent, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui"

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
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    api<Product[]>("/products").then(setProducts).catch((e) => setError(e.message))
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
    setMessage("")
    setError("")
  }

  const handleQty = (productId: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product_id !== productId) return l
          const next = Math.max(0, Math.min(qty, l.stock_qty))
          return { ...l, qty: next }
        })
        .filter((l) => l.qty > 0)
    )
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
    setMessage("")
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
      setMessage(`Sale recorded: ${order.order_no}`)
      setCart([])
      setContactName("")
      setContactPhone("")
      setProducts(await api<Product[]>("/products"))
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
        <Panel className="lg:col-span-3">
          <div className="border-b border-border p-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
            />
          </div>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto" role="list">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-alt"
                  onClick={() => handleAdd(p)}
                  disabled={p.stock_qty < 1}
                  aria-label={`Add ${p.name} to cart`}
                >
                  <div>
                    <div className="text-sm font-medium text-text">{p.name}</div>
                    <div className="text-xs text-muted">
                      {p.sku} · stock {p.stock_qty}
                    </div>
                  </div>
                  <div className="text-sm font-medium">{money(p.live_price ?? p.price ?? 0)}</div>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-4 lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-semibold">Cart</h2>
            {!cart.length ? (
              <p className="text-sm text-muted">Pick products from the list.</p>
            ) : (
              <ul className="space-y-2">
                {cart.map((l) => (
                  <li key={l.product_id} className="flex items-center gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.name}</div>
                      <div className="text-xs text-muted">{money(l.unit_price)} each</div>
                    </div>
                    <Input
                      type="number"
                      className="w-16"
                      min={1}
                      max={l.stock_qty}
                      value={l.qty}
                      onChange={(e) => handleQty(l.product_id, Number(e.target.value))}
                      aria-label={`Quantity for ${l.name}`}
                    />
                    <div className="w-20 text-right font-medium">{money(l.unit_price * l.qty)}</div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-border pt-3">
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

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

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {message ? <p className="text-sm text-success">{message}</p> : null}

            <Button type="submit" className="w-full" disabled={submitting || !cart.length}>
              {submitting ? "Recording…" : "Complete sale"}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  )
}
