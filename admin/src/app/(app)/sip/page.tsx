"use client"

import { FormEvent, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import {
  Button,
  Empty,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  Table,
  Tabs,
  Td,
  Th,
} from "@/components/ui"

interface Enrollment {
  id: string
  customer_id?: string
  member_name?: string
  member_phone?: string
  plan_name?: string
  status?: string
  next_due_date?: string
  is_due_now?: boolean
  mandate_status?: string
  summary?: { grams_accrued?: number; total_paid?: number }
}

interface SipPlan {
  id: string
  name: string
  tagline?: string
  monthly_amount: number
  tenure_months: number
  bonus_months?: number
  metal?: string
  benefit_text?: string
  active?: boolean
}

const emptyPlan = {
  name: "",
  tagline: "",
  monthly_amount: 5000,
  tenure_months: 11,
  bonus_months: 1,
  metal: "gold",
  benefit_text: "",
  active: true,
  min_amount: 0,
  rate_mode: "live",
}

export default function SipPage() {
  const [tab, setTab] = useState("enrollments")
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [plans, setPlans] = useState<SipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [dueFilter, setDueFilter] = useState<"all" | "due" | "overdue">("all")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SipPlan | null>(null)
  const [form, setForm] = useState(emptyPlan)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = async (filter = dueFilter) => {
    const [e, p] = await Promise.all([
      api<Enrollment[]>("/sip/enrollments", { query: filter === "all" ? undefined : { due: filter } }),
      api<SipPlan[]>("/sip/plans"),
    ])
    setEnrollments(e)
    setPlans(p)
    setLoading(false)
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab !== "enrollments") return
    setLoading(true)
    load(dueFilter).catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueFilter])

  const handleOpenCreate = () => {
    setEditing(null)
    setForm(emptyPlan)
    setError("")
    setOpen(true)
  }

  const handleOpenEdit = (p: SipPlan) => {
    setEditing(p)
    setForm({
      name: p.name,
      tagline: p.tagline || "",
      monthly_amount: p.monthly_amount,
      tenure_months: p.tenure_months,
      bonus_months: p.bonus_months || 0,
      metal: p.metal || "gold",
      benefit_text: p.benefit_text || "",
      active: p.active !== false,
      min_amount: 0,
      rate_mode: "live",
    })
    setError("")
    setOpen(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const body = {
        ...form,
        monthly_amount: Number(form.monthly_amount),
        tenure_months: Number(form.tenure_months),
        bonus_months: Number(form.bonus_months),
      }
      if (editing) {
        await api(`/sip/plans/${editing.id}`, { method: "PUT", body })
      } else {
        await api("/sip/plans", { method: "POST", body })
      }
      setOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this SIP plan?")) return
    await api(`/sip/plans/${id}`, { method: "DELETE" })
    await load()
  }

  const handleMandate = async (id: string, action: "pause" | "resume" | "cancel" | "charge") => {
    try {
      await api(`/sip/enrollments/${id}/mandate/${action}`, { method: "POST" })
      await load(dueFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mandate action failed")
    }
  }

  return (
    <div>
      <PageHeader
        title="Gold SIP"
        subtitle="Enrollments and plans"
        actions={
          tab === "plans" ? (
            <Button onClick={handleOpenCreate} aria-label="Add SIP plan">
              Add plan
            </Button>
          ) : null
        }
      />
      <Tabs
        tabs={[
          { id: "enrollments", label: "Enrollments" },
          { id: "plans", label: "Plans" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : tab === "enrollments" ? (
        <Panel>
          <div className="mb-3 flex flex-wrap gap-2 p-3" role="group" aria-label="Due filter">
            {(["all", "due", "overdue"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={dueFilter === f ? "primary" : "secondary"}
                onClick={() => setDueFilter(f)}
                aria-pressed={dueFilter === f}
                aria-label={`Filter ${f}`}
              >
                {f === "all" ? "All" : f === "due" ? "Due now" : "Overdue"}
              </Button>
            ))}
          </div>
          {!enrollments.length ? (
            <Empty>No SIP enrollments{dueFilter !== "all" ? " for this filter" : ""}.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Member</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th>Autopay</Th>
                  <Th>Next due</Th>
                  <Th className="text-right">Paid</Th>
                  <Th className="text-right">Grams</Th>
                  <Th>Mandate</Th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <Td>
                      {e.customer_id ? (
                        <a href={`/customers/${e.customer_id}`} className="font-medium text-text hover:underline">
                          {e.member_name || "—"}
                        </a>
                      ) : (
                        <div className="font-medium">{e.member_name || "—"}</div>
                      )}
                      <div className="text-xs text-muted">{e.member_phone}</div>
                    </Td>
                    <Td>{e.plan_name}</Td>
                    <Td className="capitalize">{e.status}</Td>
                    <Td className="capitalize text-xs">{e.mandate_status || "none"}</Td>
                    <Td>
                      <span className={e.is_due_now ? "font-medium text-warning" : ""}>
                        {e.next_due_date
                          ? new Date(e.next_due_date).toLocaleDateString("en-IN")
                          : "—"}
                        {e.is_due_now ? " · due" : ""}
                      </span>
                    </Td>
                    <Td className="text-right">{money(e.summary?.total_paid ?? 0)}</Td>
                    <Td className="text-right">{(e.summary?.grams_accrued ?? 0).toFixed(3)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {e.mandate_status === "active" ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => handleMandate(e.id, "charge")} aria-label="Charge Autopay">
                              Charge
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => handleMandate(e.id, "pause")} aria-label="Pause Autopay">
                              Pause
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleMandate(e.id, "cancel")} aria-label="Cancel Autopay">
                              Cancel
                            </Button>
                          </>
                        ) : null}
                        {e.mandate_status === "paused" ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => handleMandate(e.id, "resume")} aria-label="Resume Autopay">
                              Resume
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleMandate(e.id, "cancel")} aria-label="Cancel Autopay">
                              Cancel
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      ) : (
        <Panel>
          {!plans.length ? (
            <Empty>No SIP plans.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th className="text-right">Monthly</Th>
                  <Th className="text-right">Tenure</Th>
                  <Th className="text-right">Bonus</Th>
                  <Th>Active</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted">{p.tagline}</div>
                    </Td>
                    <Td className="text-right">{money(p.monthly_amount)}</Td>
                    <Td className="text-right">{p.tenure_months} mo</Td>
                    <Td className="text-right">{p.bonus_months ?? 0}</Td>
                    <Td>{p.active === false ? "No" : "Yes"}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(p)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)}>
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
      )}

      <Modal
        open={open}
        title={editing ? "Edit SIP plan" : "New SIP plan"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="sip-plan-form" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="sip-plan-form" onSubmit={handleSave} className="space-y-3">
          <Field label="Name" htmlFor="plan-name">
            <Input
              id="plan-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Tagline" htmlFor="tagline">
            <Input
              id="tagline"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly amount" htmlFor="monthly">
              <Input
                id="monthly"
                type="number"
                required
                value={form.monthly_amount}
                onChange={(e) => setForm({ ...form, monthly_amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Tenure (months)" htmlFor="tenure">
              <Input
                id="tenure"
                type="number"
                required
                value={form.tenure_months}
                onChange={(e) => setForm({ ...form, tenure_months: Number(e.target.value) })}
              />
            </Field>
            <Field label="Bonus months" htmlFor="bonus">
              <Input
                id="bonus"
                type="number"
                value={form.bonus_months}
                onChange={(e) => setForm({ ...form, bonus_months: Number(e.target.value) })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </form>
      </Modal>
    </div>
  )
}
