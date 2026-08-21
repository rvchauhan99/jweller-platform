"use client"

import { FormEvent, useEffect, useState } from "react"
import { api, uploadProductImage } from "@/lib/api"
import { money } from "@/lib/money"
import {
  Button,
  Empty,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui"

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  category_id: string
  purity: string
  weight_grams: number
  making_charge: number
  making_charge_type?: string
  price?: number
  live_price?: number
  stock_qty: number
  listed_online: boolean
  featured: boolean
  active?: boolean
  sku?: string
  metal?: string
  description?: string
  images?: string[]
}

const emptyForm = {
  name: "",
  category_id: "",
  purity: "22K",
  weight_grams: 0,
  making_charge: 0,
  making_charge_type: "flat",
  price: 0,
  stock_qty: 0,
  listed_online: true,
  featured: false,
  active: true,
  metal: "gold",
  description: "",
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [images, setImages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    const [p, c] = await Promise.all([
      api<Product[]>("/products"),
      api<Category[]>("/categories"),
    ])
    setProducts(p)
    setCategories(c)
    setLoading(false)
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  const handleOpenCreate = () => {
    setEditing(null)
    setForm({
      ...emptyForm,
      category_id: categories[0]?.id || "",
    })
    setImages([])
    setError("")
    setOpen(true)
  }

  const handleOpenEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name,
      category_id: p.category_id,
      purity: p.purity || "22K",
      weight_grams: p.weight_grams || 0,
      making_charge: p.making_charge || 0,
      making_charge_type: p.making_charge_type || "flat",
      price: p.price || 0,
      stock_qty: p.stock_qty || 0,
      listed_online: !!p.listed_online,
      featured: !!p.featured,
      active: p.active !== false,
      metal: p.metal || "gold",
      description: p.description || "",
    })
    setImages(p.images || [])
    setError("")
    setOpen(true)
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError("")
    try {
      const next = [...images]
      for (const file of Array.from(files)) {
        const meta = await uploadProductImage(file)
        next.push(meta.url)
      }
      setImages(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const body = {
        ...form,
        weight_grams: Number(form.weight_grams),
        making_charge: Number(form.making_charge),
        price: Number(form.price),
        stock_qty: Number(form.stock_qty),
        images,
      }
      if (editing) {
        await api(`/products/${editing.id}`, { method: "PUT", body })
      } else {
        await api("/products", { method: "POST", body })
      }
      setOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name || id

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Products and stock — gallery images on Cloudflare R2"
        actions={
          <Button onClick={handleOpenCreate} aria-label="Add product">
            Add product
          </Button>
        }
      />
      <Panel>
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : !products.length ? (
          <Empty>No products yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Category</Th>
                <Th>Purity</Th>
                <Th className="text-right">Weight</Th>
                <Th className="text-right">Making</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Stock</Th>
                <Th>Flags</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      {p.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="h-9 w-9 rounded object-cover" />
                      ) : null}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted">
                          {p.sku}
                          {p.images?.length ? ` · ${p.images.length} img` : ""}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>{catName(p.category_id)}</Td>
                  <Td>{p.purity}</Td>
                  <Td className="text-right">{p.weight_grams}g</Td>
                  <Td className="text-right">{money(p.making_charge)}</Td>
                  <Td className="text-right">{money(p.live_price ?? p.price ?? 0)}</Td>
                  <Td className={`text-right font-medium ${p.stock_qty <= 2 ? "text-danger" : ""}`}>
                    {p.stock_qty}
                  </Td>
                  <Td className="text-xs text-muted">
                    {p.listed_online ? "listed" : "unlisted"}
                    {p.featured ? " · featured" : ""}
                  </Td>
                  <Td>
                    <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(p)} aria-label={`Edit ${p.name}`}>
                      Edit
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Modal
        open={open}
        title={editing ? "Edit product" : "New product"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" disabled={saving || uploading}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-3">
          <Field label="Name" htmlFor="name">
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-label="Product name"
            />
          </Field>
          <Field label="Category" htmlFor="category_id">
            <Select
              id="category_id"
              required
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              aria-label="Category"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purity" htmlFor="purity">
              <Input
                id="purity"
                value={form.purity}
                onChange={(e) => setForm({ ...form, purity: e.target.value })}
                aria-label="Purity"
              />
            </Field>
            <Field label="Weight (g)" htmlFor="weight">
              <Input
                id="weight"
                type="number"
                step="0.01"
                value={form.weight_grams}
                onChange={(e) => setForm({ ...form, weight_grams: Number(e.target.value) })}
                aria-label="Weight grams"
              />
            </Field>
            <Field label="Making charge" htmlFor="making">
              <Input
                id="making"
                type="number"
                step="0.01"
                value={form.making_charge}
                onChange={(e) => setForm({ ...form, making_charge: Number(e.target.value) })}
                aria-label="Making charge"
              />
            </Field>
            <Field label="Stock" htmlFor="stock">
              <Input
                id="stock"
                type="number"
                value={form.stock_qty}
                onChange={(e) => setForm({ ...form, stock_qty: Number(e.target.value) })}
                aria-label="Stock quantity"
              />
            </Field>
          </div>

          <Field label="Gallery images (R2)" htmlFor="gallery">
            <div className="space-y-2">
              {images.length ? (
                <div className="flex flex-wrap gap-2">
                  {images.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-16 w-16 rounded border border-border object-cover" />
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-xs text-white"
                        onClick={() => handleRemoveImage(idx)}
                        aria-label={`Remove image ${idx + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">No images yet — upload JPEG/PNG/WEBP (max 10MB).</p>
              )}
              <Input
                id="gallery"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                onChange={(e) => handleUpload(e.target.files)}
                aria-label="Upload gallery images"
              />
              {uploading ? <p className="text-xs text-muted">Uploading to R2…</p> : null}
            </div>
          </Field>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 text-text">
              <input
                type="checkbox"
                checked={form.listed_online}
                onChange={(e) => setForm({ ...form, listed_online: e.target.checked })}
              />
              Listed online
            </label>
            <label className="flex items-center gap-2 text-text">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Featured
            </label>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </form>
      </Modal>
    </div>
  )
}
