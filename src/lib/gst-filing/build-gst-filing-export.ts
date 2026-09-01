import type { MedusaContainer } from "@medusajs/framework/types"
import {
  buildInputTaxSummary,
  loadExpensesForGstPeriod,
  type InputTaxSummary,
} from "./build-input-tax"
import {
  buildGstr1FromOrders,
  fullReportDownloadFilename,
  gstr1DownloadFilename,
  type GstFilingFilters,
  type Gstr1FilingSummary,
} from "./build-gstr1-json"
import {
  loadOrdersForGstPeriod,
  readGstFilingConfig,
} from "./load-orders-for-period"

export type GstFilingExport = {
  gstr1: Record<string, unknown>
  input_tax: InputTaxSummary
  summary: Gstr1FilingSummary & {
    input_tax_expense_count: number
    input_tax_total_gst_inr: number
    input_tax_total_purchases_inr: number
  }
  filename: string
  full_report_filename: string
}

export async function buildGstFilingExport(
  container: MedusaContainer,
  input: {
    year: number
    month: number
    filters?: GstFilingFilters
  }
): Promise<GstFilingExport> {
  const config = readGstFilingConfig()
  const [orders, expenses] = await Promise.all([
    loadOrdersForGstPeriod(container, input.year, input.month),
    loadExpensesForGstPeriod(container, input.year, input.month),
  ])

  const inputTax = await buildInputTaxSummary(container, expenses)
  const { gstr1, summary } = buildGstr1FromOrders(orders, {
    gstin: config.gstin,
    year: input.year,
    month: input.month,
    defaultHsn: config.defaultHsn,
    b2clThresholdInr: config.b2clThresholdInr,
    filters: input.filters,
  })

  return {
    gstr1,
    input_tax: inputTax,
    summary: {
      ...summary,
      input_tax_expense_count: inputTax.expense_count,
      input_tax_total_gst_inr: inputTax.total_input_gst_inr,
      input_tax_total_purchases_inr: inputTax.total_amount_inr,
    },
    filename: gstr1DownloadFilename(config.gstin, input.month, input.year),
    full_report_filename: fullReportDownloadFilename(
      config.gstin,
      input.month,
      input.year
    ),
  }
}
