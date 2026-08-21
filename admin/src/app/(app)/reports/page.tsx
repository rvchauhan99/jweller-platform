"use client"

import { useEffect, useState } from "react"
import { api, downloadCsv } from "@/lib/api"
import { money } from "@/lib/money"
import { Button, Empty, PageHeader, Panel, Table, Tabs, Td, Th } from "@/components/ui"

type TabId = "sales" | "stock" | "sip-liability"

export default function ReportsPage() {
  const [tab, setTab] = useState<TabId>("sales")
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [meta, setMeta] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    setLoading(true)
    setError("")
    const path =
      tab === "sales"
        ? "/reports/sales"
        : tab === "stock"
          ? "/reports/stock"
          : "/reports/sip-liability"

    api<{
      rows: Record<string, unknown>[]
      total?: number
      total_value?: number
      total_grams?: number
      total_liability?: number
    }>(path)
      .then((data) => {
        setRows(data.rows || [])
        if (tab === "sales") setMeta(`Total ${money(data.total ?? 0)}`)
        else if (tab === "stock") setMeta(`Stock value ${money(data.total_value ?? 0)}`)
        else
          setMeta(
            `${data.total_grams ?? 0}g · liability ${money(data.total_liability ?? 0)}`
          )
      })
      .catch((e) => setError(e.message || "Failed"))
      .finally(() => setLoading(false))
  }, [tab])

  const columns = rows[0] ? Object.keys(rows[0]) : []

  const handleDownload = () => {
    downloadCsv(`${tab}-report.csv`, rows)
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Sales, stock, and SIP liability"
        actions={
          <Button
            variant="secondary"
            onClick={handleDownload}
            disabled={!rows.length}
            aria-label="Download CSV"
          >
            Download CSV
          </Button>
        }
      />
      <Tabs
        tabs={[
          { id: "sales", label: "Sales" },
          { id: "stock", label: "Stock" },
          { id: "sip-liability", label: "SIP liability" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {meta ? <p className="mb-3 text-sm text-muted">{meta}</p> : null}
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <Panel>
        {loading ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : !rows.length ? (
          <Empty>No rows.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <Th key={c}>{c.replace(/_/g, " ")}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => {
                    const v = r[c]
                    const display =
                      typeof v === "number" &&
                      (c.includes("subtotal") ||
                        c.includes("cost") ||
                        c.includes("value") ||
                        c.includes("paid") ||
                        c.includes("liability"))
                        ? money(v)
                        : v == null
                          ? "—"
                          : String(v)
                    return (
                      <Td key={c} className={typeof v === "number" ? "text-right" : ""}>
                        {display}
                      </Td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
