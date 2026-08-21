"use client"

import { FormEvent, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import {
  Button,
  Empty,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui"

interface Product {
  id: string
  name: string
  sku?: string
}

interface Purchase {
  id: string
  product_id: string
  product_name?: string
  qty: number
  unit_cost: number
  total_cost: number
  supplier?: string
  avg_cost_after?: number
  created_at?: string
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productId, setProductId] = useState("")
  const [qty, setQty] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [supplier, setSupplier] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const load = async () => {
    const [p, pr] = await Promise.all([
      api<Purchase[]>("/purchases"),
      api<Product[]>("/products"),
    ])
    setPurchases(p)
    setProducts(pr)
    if (!productId && pr[0]) setProductId(pr[0].id)
    setLoading(false)
  }

  useEffect(() => {
    load().catch((e) => {
      setError(e.message)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await api("/purchases", {
        method: "POST",
        body: {
          product_id: productId,
          qty: Number(qty),
          unit_cost: Number(unitCost),
          supplier: supplier.trim() || undefined,
        },
      })
      setMessage("Purchase recorded (WAC updated).")
      setQty(1)
      setUnitCost(0)
      setSupplier("")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Purchases" subtitle="Stock in with weighted average cost" />

      <Panel className="mb-5 p-4">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Product" htmlFor="product_id" className="lg:col-span-2">
            <Select
              id="product_id"
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Qty" htmlFor="qty">
            <Input
              id="qty"
              type="number"
              min={1}
              required
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </Field>
          <Field label="Unit cost" htmlFor="unit_cost">
            <Input
              id="unit_cost"
              type="number"
              min={0}
              step="0.01"
              required
              value={unitCost}
              onChange={(e) => setUnitCost(Number(e.target.value))}
            />
          </Field>
          <Field label="Supplier" htmlFor="supplier">
            <Input
              id="supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </Field>
          <div className="flex items-end sm:col-span-2 lg:col-span-5">
            <Button type="submit" disabled={saving || !productId}>
              {saving ? "Saving…" : "Record purchase"}
            </Button>
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        {message ? <p className="mt-2 text-sm text-success">{message}</p> : null}
      </Panel>

      <Panel>
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : !purchases.length ? (
          <Empty>No purchases yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Product</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Unit cost</Th>
                <Th className="text-right">Total</Th>
                <Th>Supplier</Th>
                <Th className="text-right">WAC after</Th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <Td className="text-xs text-muted">
                    {p.created_at ? new Date(p.created_at).toLocaleString("en-IN") : "—"}
                  </Td>
                  <Td>{p.product_name}</Td>
                  <Td className="text-right">{p.qty}</Td>
                  <Td className="text-right">{money(p.unit_cost)}</Td>
                  <Td className="text-right font-medium">{money(p.total_cost)}</Td>
                  <Td>{p.supplier || "—"}</Td>
                  <Td className="text-right">{money(p.avg_cost_after ?? 0)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
