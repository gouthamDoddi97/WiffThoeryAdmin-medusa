import { Badge, Button, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { isImageAttachment } from "../budget/upload"

export type InputTaxExpenseLine = {
  id: string
  date: string
  vendor: string | null
  description: string
  amount_inr: number
  gst_amount_inr: number
  taxable_value_inr: number
  from_plan: boolean
  payment_method: string | null
  payment_method_label: string | null
  recorded_by: string | null
  notes: string | null
  receipt_url: string | null
  category_id: string | null
  category_name: string | null
  plan_id: string | null
  plan_title: string | null
  funding_source_id: string | null
  plan_invoice_url?: string | null
}

const fmtInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)

function invoiceUrl(expense: InputTaxExpenseLine): string | null {
  return expense.receipt_url?.trim() || expense.plan_invoice_url?.trim() || null
}

export function InputTaxExpenseDetailPanel({
  line,
  open,
  onClose,
}: {
  line: InputTaxExpenseLine | null
  open: boolean
  onClose: () => void
}) {
  const [detail, setDetail] = useState<InputTaxExpenseLine | null>(line)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDetail(line)
    if (!open || !line?.id) {
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/admin/gst-filing/expenses/${line.id}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { expense?: InputTaxExpenseLine } | null) => {
        if (cancelled || !data?.expense) return
        setDetail(data.expense)
      })
      .catch(() => {
        /* keep preview row data */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [line, open])

  if (!open || !detail) {
    return null
  }

  const receipt = invoiceUrl(detail)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ui-bg-overlay"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-modal flex flex-col gap-4 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <Heading level="h2">Input GST expense</Heading>
            <Text size="small" className="text-ui-fg-muted mt-1">
              {detail.date}
              {detail.vendor ? ` · ${detail.vendor}` : ""}
            </Text>
          </div>
          <Button variant="secondary" size="small" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {detail.from_plan && (
            <Badge size="small" color="blue">
              From purchase plan
            </Badge>
          )}
          {detail.category_name && (
            <Badge size="small">{detail.category_name}</Badge>
          )}
        </div>

        <Text className="text-sm font-medium">{detail.description}</Text>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Text className="text-ui-fg-muted">Taxable value</Text>
            <Text className="font-medium">{fmtInr(detail.taxable_value_inr)}</Text>
          </div>
          <div>
            <Text className="text-ui-fg-muted">Input GST (ITC)</Text>
            <Text className="font-medium">{fmtInr(detail.gst_amount_inr)}</Text>
          </div>
          <div>
            <Text className="text-ui-fg-muted">Total paid</Text>
            <Text className="font-medium">{fmtInr(detail.amount_inr)}</Text>
          </div>
          <div>
            <Text className="text-ui-fg-muted">Payment</Text>
            <Text className="font-medium">
              {detail.payment_method_label ?? "—"}
            </Text>
          </div>
          {detail.plan_title && (
            <div className="col-span-2">
              <Text className="text-ui-fg-muted">Purchase plan</Text>
              <Text className="font-medium">{detail.plan_title}</Text>
            </div>
          )}
          {detail.recorded_by && (
            <div>
              <Text className="text-ui-fg-muted">Recorded by</Text>
              <Text className="font-medium">{detail.recorded_by}</Text>
            </div>
          )}
        </div>

        {detail.notes && (
          <div className="rounded-md bg-ui-bg-subtle p-3 text-sm text-ui-fg-subtle">
            {detail.notes}
          </div>
        )}

        <div className="border-t border-ui-border-base pt-4 flex flex-col gap-3">
          <Heading level="h3">Invoice / receipt</Heading>
          {loading && !receipt ? (
            <Text size="small" className="text-ui-fg-muted">
              Loading…
            </Text>
          ) : receipt ? (
            <div className="flex flex-col gap-3">
              {isImageAttachment(receipt) ? (
                <a href={receipt} target="_blank" rel="noreferrer">
                  <img
                    src={receipt}
                    alt="GST invoice"
                    className="max-h-80 w-full rounded-md border border-ui-border-base object-contain bg-ui-bg-subtle"
                  />
                </a>
              ) : (
                <iframe
                  title="GST invoice PDF"
                  src={receipt}
                  className="h-80 w-full rounded-md border border-ui-border-base bg-ui-bg-subtle"
                />
              )}
              <a
                href={receipt}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-ui-fg-interactive hover:underline"
              >
                Open invoice in new tab
              </a>
            </div>
          ) : (
            <Text size="small" className="text-ui-fg-muted">
              No invoice attached for this expense.
            </Text>
          )}
        </div>
      </div>
    </div>
  )
}
