"use client"

import { FormEvent, useEffect, useState } from "react"
import { api } from "@/lib/api"
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

interface Staff {
  username: string
  role: string
  active: boolean
  created_at?: string
  phone?: string | null
  phone_masked?: string | null
  two_fa_enabled?: boolean
}

const emptyForm = {
  username: "",
  password: "",
  role: "staff",
  active: true,
  phone: "",
}

export default function StaffPage() {
  const [rows, setRows] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const load = async () => {
    try {
      setRows(await api<Staff[]>("/staff"))
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff (owner only)")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleOpenCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError("")
    setOpen(true)
  }

  const handleOpenEdit = (s: Staff) => {
    setEditing(s)
    setForm({
      username: s.username,
      password: "",
      role: s.role,
      active: s.active,
      phone: s.phone?.replace(/^\+91/, "") || "",
    })
    setFormError("")
    setOpen(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError("")
    try {
      const phone = form.phone.trim()
      if (editing) {
        await api(`/staff/${encodeURIComponent(editing.username)}`, {
          method: "PUT",
          body: {
            username: editing.username,
            role: form.role,
            active: form.active,
            password: form.password || undefined,
            phone,
          },
        })
      } else {
        await api("/staff", {
          method: "POST",
          body: {
            username: form.username.trim(),
            password: form.password,
            role: form.role,
            active: true,
            phone: phone || undefined,
          },
        })
      }
      setOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (username: string) => {
    if (!confirm(`Delete staff ${username}?`)) return
    await api(`/staff/${encodeURIComponent(username)}`, { method: "DELETE" })
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Owner-managed accounts for this tenant"
        actions={
          <Button onClick={handleOpenCreate} aria-label="Add staff">
            Add staff
          </Button>
        }
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <Panel>
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : !rows.length ? (
          <Empty>No staff accounts.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Username</Th>
                <Th>Phone</Th>
                <Th>Role</Th>
                <Th>2FA</Th>
                <Th>Active</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.username}>
                  <Td className="font-medium">{s.username}</Td>
                  <Td className="text-muted">{s.phone_masked || "—"}</Td>
                  <Td className="capitalize">{s.role}</Td>
                  <Td>{s.two_fa_enabled ? "On" : "Off"}</Td>
                  <Td>{s.active ? "Yes" : "No"}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(s)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(s.username)}>
                        Delete
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Modal
        open={open}
        title={editing ? "Edit staff" : "New staff"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleSave} className="space-y-3">
          {!editing ? (
            <Field label="Username" htmlFor="username">
              <Input
                id="username"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>
          ) : (
            <p className="text-sm text-muted">Username: {editing.username}</p>
          )}
          <Field label={editing ? "New password (blank = keep)" : "Password"} htmlFor="password">
            <Input
              id="password"
              type="password"
              required={!editing}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Field label="Phone (+91, for forgot password)" htmlFor="phone">
            <Input
              id="phone"
              inputMode="numeric"
              placeholder="9876543210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            />
          </Field>
          <Field label="Role" htmlFor="role">
            <Select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </Select>
          </Field>
          {editing ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
          ) : null}
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        </form>
      </Modal>
    </div>
  )
}
