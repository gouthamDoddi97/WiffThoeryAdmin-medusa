import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"
import { Badge, Button, Checkbox, Heading, Label, Text, toast } from "@medusajs/ui"
import { useCallback, useMemo, useState } from "react"
import { useCaAccessGuard } from "../../lib/ca-access"
import { ManageGstRecordsPanel } from "./manage-gst-records"

type Gstr1Summary = {
  gstin: string
  filing_period: string
  orders_in_period: number
  order_count: number
  offline_order_count: number
  online_order_count: number
  skipped_zero_total: number
  skipped_canceled: number
  skipped_non_india: number
  skipped_online: number
  skipped_offline: number
  skipped_gst_excluded: number
  skipped_ignore_sales: boolean
  total_taxable_inr: number
  total_tax_inr: number
  total_invoice_value_inr: number
  b2cs_aggregate_lines: number
  b2cl_invoices: number
  hsn_lines: number
  hsn_taxable_inr: number
  totals_consistent: boolean
  input_tax_expense_count: number
  input_tax_total_gst_inr: number
  input_tax_total_purchases_inr: number
}

type InputTaxLine = {
  id: string
  date: string
  vendor: string | null
  description: string
  amount_inr: number
  gst_amount_inr: number
  taxable_value_inr: number
  from_plan: boolean
}

type GstFilingResponse = {
  summary: Gstr1Summary
  gstr1: Record<string, unknown>
  input_tax: {
    expense_count: number
    total_amount_inr: number
    total_input_gst_inr: number
    total_taxable_purchases_inr: number
    lines: InputTaxLine[]
  }
  filename: string
  full_report_filename: string
}

function formatPeriodLabel(monthValue: string): string {
  if (!monthValue) return ""
  const [year, month] = monthValue.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleString("en-IN", { month: "long", year: "numeric" })
}

function formatFpLabel(fp: string): string {
  if (fp.length !== 6) return fp
  const month = Number(fp.slice(0, 2))
  const year = Number(fp.slice(2))
  const date = new Date(year, month - 1, 1)
  return date.toLocaleString("en-IN", { month: "short", year: "numeric" })
}

const fmtInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)

function buildQuery(
  year: number,
  month: number,
  filters: {
    ignoreSales: boolean
    ignoreOnlineSales: boolean
    ignoreOfflineSales: boolean
  },
  download?: "gstr1" | "full"
): string {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  })

  if (filters.ignoreSales) params.set("ignore_sales", "1")
  if (filters.ignoreOnlineSales) params.set("ignore_online_sales", "1")
  if (filters.ignoreOfflineSales) params.set("ignore_offline_sales", "1")
  if (download === "gstr1") params.set("download", "gstr1")
  if (download === "full") params.set("download", "full")

  return params.toString()
}

const GstFilingPage = () => {
  useCaAccessGuard()

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [monthValue, setMonthValue] = useState(defaultMonth)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GstFilingResponse | null>(null)
  const [ignoreSales, setIgnoreSales] = useState(false)
  const [ignoreOnlineSales, setIgnoreOnlineSales] = useState(false)
  const [ignoreOfflineSales, setIgnoreOfflineSales] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const { year, month } = useMemo(() => {
    const [y, m] = monthValue.split("-")
    return { year: Number(y), month: Number(m) }
  }, [monthValue])

  const filters = useMemo(
    () => ({
      ignoreSales,
      ignoreOnlineSales,
      ignoreOfflineSales,
    }),
    [ignoreSales, ignoreOnlineSales, ignoreOfflineSales]
  )

  const filterQueryString = useMemo(
    () => buildQuery(year, month, filters),
    [year, month, filters]
  )

  const loadPreview = useCallback(async () => {
    if (!year || !month) {
      toast.error("Select a valid month")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `/admin/gst-filing?${filterQueryString}`,
        { credentials: "include" }
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? "Failed to load GST data")
      }
      setResult(data as GstFilingResponse)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load GST data"
      )
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [filterQueryString])

  const downloadFile = useCallback(
    async (mode: "gstr1" | "full") => {
      if (!year || !month) {
        toast.error("Select a valid month")
        return
      }

      setLoading(true)
      try {
        const res = await fetch(
          `/admin/gst-filing?${buildQuery(year, month, filters, mode)}`,
          { credentials: "include" }
        )

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.message ?? "Download failed")
        }

        const blob = await res.blob()
        const disposition = res.headers.get("Content-Disposition") ?? ""
        const match = disposition.match(/filename="([^"]+)"/)
        const fallback =
          mode === "gstr1"
            ? result?.filename
            : result?.full_report_filename
        const filename =
          match?.[1] ?? fallback ?? `gst_${monthValue.replace("-", "")}.json`

        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = filename
        anchor.click()
        URL.revokeObjectURL(url)

        toast.success(
          mode === "gstr1"
            ? "GSTR-1 JSON downloaded (portal upload)"
            : "Full GST report downloaded"
        )
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Download failed"
        )
      } finally {
        setLoading(false)
      }
    },
    [year, month, filters, monthValue, result?.filename, result?.full_report_filename]
  )

  return (
    <div className="flex flex-col gap-y-6 p-6 max-w-4xl">
      <div>
        <Heading level="h1">GST Filing</Heading>
        <Text className="text-ui-fg-subtle mt-1">
          Export Form GSTR-1 JSON for gst.gov.in and review input GST from Budget
          expenses (supplier purchases).
        </Text>
      </div>

      <div className="rounded-lg border border-ui-border-base p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-2 max-w-xs">
          <Label htmlFor="gst-month">Return period</Label>
          <input
            id="gst-month"
            type="month"
            className="border border-ui-border-base rounded-md px-3 py-2 text-sm bg-ui-bg-base"
            value={monthValue}
            onChange={(e) => {
              setMonthValue(e.target.value)
              setResult(null)
            }}
          />
          <Text size="small" className="text-ui-fg-muted">
            {formatPeriodLabel(monthValue)} · filing period code{" "}
            {month && year
              ? `${String(month).padStart(2, "0")}${year}`
              : "—"}
          </Text>
        </div>

        <div className="flex flex-col gap-3 border-t border-ui-border-base pt-4">
          <Text className="text-sm font-medium">Include in export</Text>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={!ignoreSales}
              onCheckedChange={(checked) => {
                setIgnoreSales(checked !== true)
                setResult(null)
              }}
            />
            Outward sales (GSTR-1 B2CS / B2CL / HSN)
          </label>
          <label
            className={`flex items-center gap-2 text-sm pl-6 ${ignoreSales ? "opacity-50" : "cursor-pointer"}`}
          >
            <Checkbox
              checked={!ignoreOnlineSales}
              disabled={ignoreSales}
              onCheckedChange={(checked) => {
                setIgnoreOnlineSales(checked !== true)
                setResult(null)
              }}
            />
            Online sales (storefront / Razorpay)
          </label>
          <label
            className={`flex items-center gap-2 text-sm pl-6 ${ignoreSales ? "opacity-50" : "cursor-pointer"}`}
          >
            <Checkbox
              checked={!ignoreOfflineSales}
              disabled={ignoreSales}
              onCheckedChange={(checked) => {
                setIgnoreOfflineSales(checked !== true)
                setResult(null)
              }}
            />
            Offline sales (in-person / retail)
          </label>
          <Text size="small" className="text-ui-fg-muted">
            Uncheck a box to exclude that category. Budget expenses (input GST)
            are always included in the preview and full report.
          </Text>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => setManageOpen(true)}
            disabled={ignoreSales}
          >
            Manage GST records
          </Button>
          <Button
            variant="secondary"
            onClick={loadPreview}
            isLoading={loading}
          >
            Preview
          </Button>
          <Button
            onClick={() => downloadFile("gstr1")}
            isLoading={loading}
            disabled={ignoreSales}
          >
            Download GSTR-1 JSON
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadFile("full")}
            isLoading={loading}
          >
            Download full report
          </Button>
        </div>
      </div>

      <ManageGstRecordsPanel
        year={year}
        month={month}
        queryString={filterQueryString}
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onSaved={() => {
          if (result) {
            loadPreview()
          }
        }}
      />

      {result && (
        <>
          {!result.summary.totals_consistent &&
            !result.summary.skipped_ignore_sales &&
            result.summary.order_count > 0 && (
              <div className="rounded-lg border border-ui-border-warning bg-ui-bg-subtle p-4">
                <Text className="text-sm text-ui-fg-subtle">
                  HSN taxable ({fmtInr(result.summary.hsn_taxable_inr)}) does not
                  match item subtotals — review order line data in Medusa before
                  filing.
                </Text>
              </div>
            )}

          <div className="rounded-lg border border-ui-border-base p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Heading level="h2">Sales (GSTR-1)</Heading>
              <Badge size="small" color="green">
                {formatFpLabel(result.summary.filing_period)}
              </Badge>
              {result.summary.skipped_ignore_sales && (
                <Badge size="small" color="orange">
                  Sales excluded
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <Text className="text-ui-fg-muted">Orders in period</Text>
                <Text className="font-medium">
                  {result.summary.orders_in_period}
                </Text>
              </div>
              <div>
                <Text className="text-ui-fg-muted">Included in GSTR-1</Text>
                <Text className="font-medium">{result.summary.order_count}</Text>
              </div>
              <div>
                <Text className="text-ui-fg-muted">Offline / online</Text>
                <Text className="font-medium">
                  {result.summary.offline_order_count} /{" "}
                  {result.summary.online_order_count}
                </Text>
              </div>
              <div>
                <Text className="text-ui-fg-muted">Taxable value</Text>
                <Text className="font-medium">
                  {fmtInr(result.summary.total_taxable_inr)}
                </Text>
              </div>
              <div>
                <Text className="text-ui-fg-muted">GST collected</Text>
                <Text className="font-medium">
                  {fmtInr(result.summary.total_tax_inr)}
                </Text>
              </div>
              <div>
                <Text className="text-ui-fg-muted">Invoice value</Text>
                <Text className="font-medium">
                  {fmtInr(result.summary.total_invoice_value_inr)}
                </Text>
              </div>
              <div>
                <Text className="text-ui-fg-muted">HSN taxable</Text>
                <Text className="font-medium">
                  {fmtInr(result.summary.hsn_taxable_inr)}
                </Text>
              </div>
            </div>

            {(result.summary.skipped_online > 0 ||
              result.summary.skipped_offline > 0 ||
              result.summary.skipped_canceled > 0 ||
              result.summary.skipped_zero_total > 0 ||
              result.summary.skipped_gst_excluded > 0) && (
              <Text size="small" className="text-ui-fg-muted">
                Skipped: {result.summary.skipped_online} online,{" "}
                {result.summary.skipped_offline} offline,{" "}
                {result.summary.skipped_canceled} canceled,{" "}
                {result.summary.skipped_zero_total} with ₹0 total,{" "}
                {result.summary.skipped_gst_excluded} unchecked in Manage GST
                records.
              </Text>
            )}

            {result.summary.orders_in_period > 0 &&
              result.summary.order_count === 0 && (
                <Text size="small" className="text-ui-fg-subtle">
                  Orders exist for this month but none were included — check the
                  include checkboxes above, or confirm sales have a non-zero
                  total.
                </Text>
              )}

            {result.summary.orders_in_period === 0 && (
              <Text size="small" className="text-ui-fg-subtle">
                No orders found for this month. Pick the month when the offline
                sale was recorded (same as order date in Offline Sales).
              </Text>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-ui-fg-interactive">
                View GSTR-1 JSON
              </summary>
              <pre className="mt-2 p-3 bg-ui-bg-subtle rounded-md overflow-auto max-h-96">
                {JSON.stringify(result.gstr1, null, 2)}
              </pre>
            </details>
          </div>

          <div className="rounded-lg border border-ui-border-base p-5 flex flex-col gap-4">
            <Heading level="h2">Purchases — input GST (Budget expenses)</Heading>
            <Text size="small" className="text-ui-fg-muted">
              GST paid to suppliers from Budget → Expenses. Use this for GSTR-3B
              ITC — not uploaded via GSTR-1 JSON.
            </Text>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <Text className="text-ui-fg-muted">Expenses with GST</Text>
                <Text className="font-medium">
                  {result.summary.input_tax_expense_count}
                </Text>
              </div>
              <div>
                <Text className="text-ui-fg-muted">Total paid</Text>
                <Text className="font-medium">
                  {fmtInr(result.summary.input_tax_total_purchases_inr)}
                </Text>
              </div>
              <div>
                <Text className="text-ui-fg-muted">Input GST (ITC)</Text>
                <Text className="font-medium">
                  {fmtInr(result.summary.input_tax_total_gst_inr)}
                </Text>
              </div>
            </div>

            {result.input_tax.lines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ui-border-base text-left text-ui-fg-muted">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Vendor</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3 text-right">GST</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.input_tax.lines.map((line) => (
                      <tr
                        key={line.id}
                        className="border-b border-ui-border-base/60"
                      >
                        <td className="py-2 pr-3">{line.date}</td>
                        <td className="py-2 pr-3">{line.vendor ?? "—"}</td>
                        <td className="py-2 pr-3">{line.description}</td>
                        <td className="py-2 pr-3 text-right">
                          {fmtInr(line.gst_amount_inr)}
                        </td>
                        <td className="py-2 text-right">
                          {fmtInr(line.amount_inr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-muted">
                No expenses with GST recorded for this month in Budget →
                Expenses.
              </Text>
            )}
          </div>
        </>
      )}

      <div className="rounded-lg border border-ui-border-base p-5">
        <Heading level="h2" className="mb-2">
          Upload steps (sales only)
        </Heading>
        <ol className="list-decimal list-inside text-sm text-ui-fg-subtle space-y-1">
          <li>Use <strong>Download GSTR-1 JSON</strong> for gst.gov.in offline upload</li>
          <li>Use <strong>Download full report</strong> for purchases + sales together</li>
          <li>Enter input GST from expenses manually in GSTR-3B on the portal</li>
        </ol>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "GST Filing",
  icon: DocumentText,
})

export default GstFilingPage
