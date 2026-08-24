import { Badge, Button, Checkbox, Heading, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

export type GstSaleRecord = {
  order_id: string
  display_id: string | number | null
  created_at: string
  channel: "offline" | "online"
  customer_label: string
  list_total_inr: number
  discount_inr: number
  paid_total_inr: number
  taxable_inr: number
  gst_inr: number
  include_in_gst: boolean
  has_zero_total: boolean
}

type GstRecordsResponse = {
  records: GstSaleRecord[]
  counts: {
    total: number
    included: number
    excluded: number
    offline: number
    online: number
  }
}

type ManageGstRecordsPanelProps = {
  year: number
  month: number
  queryString: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const fmtInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)

export function ManageGstRecordsPanel({
  year,
  month,
  queryString,
  open,
  onClose,
  onSaved,
}: ManageGstRecordsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [records, setRecords] = useState<GstSaleRecord[]>([])
  const [counts, setCounts] = useState<GstRecordsResponse["counts"] | null>(null)
  const [draft, setDraft] = useState<Record<string, boolean>>({})

  const loadRecords = useCallback(async () => {
    if (!year || !month) return

    setLoading(true)
    try {
      const res = await fetch(`/admin/gst-filing/records?${queryString}`, {
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? "Failed to load records")
      }

      const payload = data as GstRecordsResponse
      setRecords(payload.records)
      setCounts(payload.counts)
      setDraft(
        Object.fromEntries(
          payload.records.map((row) => [row.order_id, row.include_in_gst])
        )
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load records"
      )
    } finally {
      setLoading(false)
    }
  }, [year, month, queryString])

  useEffect(() => {
    if (open) {
      loadRecords()
    }
  }, [open, loadRecords])

  const dirty = useMemo(() => {
    return records.some((row) => draft[row.order_id] !== row.include_in_gst)
  }, [records, draft])

  const draftCounts = useMemo(() => {
    const values = records.map((row) => draft[row.order_id] ?? row.include_in_gst)
    return {
      included: values.filter(Boolean).length,
      excluded: values.filter((v) => !v).length,
    }
  }, [records, draft])

  const setAll = (include: boolean) => {
    setDraft(
      Object.fromEntries(records.map((row) => [row.order_id, include]))
    )
  }

  const save = async () => {
    const updates = records
      .filter((row) => draft[row.order_id] !== row.include_in_gst)
      .map((row) => ({
        order_id: row.order_id,
        include: draft[row.order_id] ?? row.include_in_gst,
      }))

    if (!updates.length) {
      onClose()
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/admin/gst-filing/records", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? "Failed to save")
      }
      toast.success(`Updated ${data.updated ?? updates.length} record(s)`)
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-base flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Heading level="h2">Manage GST records</Heading>
          <Text size="small" className="text-ui-fg-muted mt-1">
            Only checked sales are included in GSTR-1 preview and export.
            Respects online/offline filters from above.
          </Text>
        </div>
        <Button variant="secondary" size="small" onClick={onClose}>
          Close
        </Button>
      </div>

      {counts && (
        <div className="flex flex-wrap gap-2">
          <Badge size="small">{counts.total} in list</Badge>
          <Badge size="small" color="green">
            {draftCounts.included} included
          </Badge>
          <Badge size="small" color="orange">
            {draftCounts.excluded} excluded
          </Badge>
          <Badge size="small">{counts.offline} offline</Badge>
          <Badge size="small">{counts.online} online</Badge>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="small"
          onClick={() => setAll(true)}
          disabled={loading || !records.length}
        >
          Include all
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={() => setAll(false)}
          disabled={loading || !records.length}
        >
          Exclude all
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={loadRecords}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <Text size="small" className="text-ui-fg-muted">
          Loading sales…
        </Text>
      ) : records.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          No sales match this month and filter. Adjust the month or include
          checkboxes above.
        </Text>
      ) : (
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto border border-ui-border-base rounded-md">
          <table className="w-full text-sm min-w-[960px]">
            <thead className="sticky top-0 bg-ui-bg-subtle text-left text-ui-fg-muted">
              <tr>
                <th className="px-3 py-2 w-10">GST</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2 text-right">Tag / list</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Taxable</th>
                <th className="px-3 py-2 text-right">GST</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => {
                const included = draft[row.order_id] ?? row.include_in_gst
                return (
                  <tr
                    key={row.order_id}
                    className={`border-t border-ui-border-base/60 ${!included ? "opacity-60" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={included}
                        disabled={row.has_zero_total}
                        onCheckedChange={(checked) => {
                          setDraft((prev) => ({
                            ...prev,
                            [row.order_id]: checked === true,
                          }))
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">
                      #{row.display_id ?? "—"}
                    </td>
                    <td className="px-3 py-2">{row.created_at}</td>
                    <td className="px-3 py-2 capitalize">{row.channel}</td>
                    <td className="px-3 py-2">{row.customer_label}</td>
                    <td className="px-3 py-2 text-right">
                      {fmtInr(row.list_total_inr)}
                    </td>
                    <td className="px-3 py-2 text-right text-ui-fg-muted">
                      {row.discount_inr > 0
                        ? `−${fmtInr(row.discount_inr)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {fmtInr(row.paid_total_inr)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmtInr(row.taxable_inr)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmtInr(row.gst_inr)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end border-t border-ui-border-base pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} isLoading={saving} disabled={!dirty || loading}>
          Save selection
        </Button>
      </div>
    </div>
  )
}
