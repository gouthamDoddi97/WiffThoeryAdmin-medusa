import { INR_GST_RATE, splitTaxInclusiveAmount } from "../currency/inr-amounts"
import {
  computeOrderGstBreakdown,
  isGstFilingIncluded,
  orderGstrAmounts,
} from "./order-gst-amounts"
import { isOfflineSaleOrder } from "./period"
import { resolvePlaceOfSupply, supplierStateFromGstin } from "./state-codes"

/** Inter-state B2C invoice value above this goes in B2CL (₹1L from Aug 2024). */
export const B2CL_THRESHOLD_INR = 100_000

export type GstFilingOrderRow = {
  id: string
  display_id?: number | string | null
  created_at?: string | Date | null
  canceled_at?: string | Date | null
  total?: number | null
  item_subtotal?: number | null
  item_tax_total?: number | null
  tax_total?: number | null
  shipping_subtotal?: number | null
  shipping_tax_total?: number | null
  metadata?: Record<string, unknown> | null
  summary?: { current_order_total?: number | null } | null
  shipping_address?: {
    province?: string | null
    postal_code?: string | null
    country_code?: string | null
  } | null
  items?: Array<{
    title?: string | null
    product_title?: string | null
    quantity?: number | null
    unit_price?: number | null
    subtotal?: number | null
    tax_total?: number | null
    variant_sku?: string | null
    detail?: {
      subtotal?: number | null
      tax_total?: number | null
    } | null
  }> | null
}

export type GstFilingFilters = {
  /** Skip all outward sales (B2CS, B2CL, HSN, doc_issue). */
  ignoreSales?: boolean
  /** Skip storefront / Razorpay orders. */
  ignoreOnlineSales?: boolean
  /** Skip in-person offline sales. */
  ignoreOfflineSales?: boolean
}

export type Gstr1BuildConfig = {
  gstin: string
  year: number
  month: number
  defaultHsn?: string
  b2clThresholdInr?: number
  filters?: GstFilingFilters
}

export type Gstr1FilingSummary = {
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
}

type B2csKey = string

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function formatFp(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}${year}`
}

function formatInvoiceDate(value?: string | Date | null): string {
  const date = value ? new Date(value) : new Date()
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function orderInvoiceNumber(displayId?: number | string | null): string {
  if (displayId == null || displayId === "") {
    return "WT-DRAFT"
  }
  return `WT-${displayId}`
}

/** Line totals from Medusa tax lines — not tax-inclusive unit_price × qty. */
function lineItemTaxableAndTax(line: NonNullable<GstFilingOrderRow["items"]>[number]): {
  txval: number
  tax: number
  qty: number
} {
  const qty = Number(line.quantity ?? 1)
  const lineSub = Number(
    line.subtotal ?? line.detail?.subtotal ?? 0
  )
  const lineTax = Number(line.tax_total ?? line.detail?.tax_total ?? 0)

  if (lineSub > 0 || lineTax > 0) {
    return {
      txval: round2(lineSub),
      tax: round2(lineTax),
      qty,
    }
  }

  const lineTotal = round2(Number(line.unit_price ?? 0) * qty)
  if (lineTotal <= 0) {
    return { txval: 0, tax: 0, qty }
  }

  const parts = splitTaxInclusiveAmount(lineTotal)
  return { txval: parts.subtotal, tax: parts.tax, qty }
}

function splitTaxAmount(tax: number, isIntra: boolean): {
  iamt: number
  camt: number
  samt: number
} {
  if (tax <= 0) {
    return { iamt: 0, camt: 0, samt: 0 }
  }

  if (isIntra) {
    const half = round2(tax / 2)
    return { iamt: 0, camt: half, samt: round2(tax - half) }
  }

  return { iamt: round2(tax), camt: 0, samt: 0 }
}

function gstRatePercent(): number {
  return Math.round(INR_GST_RATE * 100)
}

function lineWeight(line: NonNullable<GstFilingOrderRow["items"]>[number]): number {
  const fromLine = Number(line.subtotal ?? line.detail?.subtotal ?? 0)
  if (fromLine > 0) {
    return fromLine
  }
  return Number(line.unit_price ?? 0) * Number(line.quantity ?? 1)
}

function accumulateHsnLine(input: {
  line: NonNullable<GstFilingOrderRow["items"]>[number]
  order: GstFilingOrderRow
  isIntra: boolean
  defaultHsn: string
  gstrScale: number
  hsnMap: Map<
    string,
    { txval: number; qty: number; iamt: number; camt: number; samt: number; desc: string }
  >
  onTaxable: (value: number) => void
}) {
  const { line, order, isIntra, defaultHsn, gstrScale, hsnMap, onTaxable } = input
  const lines = order.items ?? []
  const orderItemSub = Number(order.item_subtotal ?? 0)
  const orderItemTax = Number(order.item_tax_total ?? 0)

  let lineTx = 0
  let lineTaxAmt = 0
  const qty = Number(line.quantity ?? 1)

  const direct = lineItemTaxableAndTax(line)
  if (direct.txval > 0 || direct.tax > 0) {
    lineTx = direct.txval
    lineTaxAmt = direct.tax
  } else if (orderItemSub > 0 && lines.length > 0) {
    const weights = lines.map(lineWeight)
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    const index = lines.indexOf(line)
    const share = totalWeight > 0 ? weights[index] / totalWeight : 1 / lines.length
    lineTx = round2(orderItemSub * share)
    lineTaxAmt = round2(orderItemTax * share)
  }

  if (lineTx <= 0 && lineTaxAmt <= 0) {
    return
  }

  if (gstrScale > 0 && gstrScale !== 1) {
    lineTx = round2(lineTx * gstrScale)
    lineTaxAmt = round2(lineTaxAmt * gstrScale)
  }

  const lineTax = splitTaxAmount(lineTaxAmt, isIntra)
  const hsnKey = defaultHsn
  const hsnRow = hsnMap.get(hsnKey) ?? {
    txval: 0,
    qty: 0,
    iamt: 0,
    camt: 0,
    samt: 0,
    desc: line.product_title ?? line.title ?? "Perfume",
  }
  hsnRow.txval = round2(hsnRow.txval + lineTx)
  hsnRow.qty = round2(hsnRow.qty + qty)
  hsnRow.iamt = round2(hsnRow.iamt + lineTax.iamt)
  hsnRow.camt = round2(hsnRow.camt + lineTax.camt)
  hsnRow.samt = round2(hsnRow.samt + lineTax.samt)
  hsnMap.set(hsnKey, hsnRow)
  onTaxable(lineTx)
}

export function shouldIncludeOrderChannel(
  order: GstFilingOrderRow,
  filters: GstFilingFilters
): { include: boolean; reason?: "online" | "offline" } {
  if (filters.ignoreSales) {
    return { include: false }
  }

  const isOffline = isOfflineSaleOrder(order.metadata)

  if (isOffline && filters.ignoreOfflineSales) {
    return { include: false, reason: "offline" }
  }

  if (!isOffline && filters.ignoreOnlineSales) {
    return { include: false, reason: "online" }
  }

  return { include: true }
}

export function shouldIncludeOrderForGst(
  order: GstFilingOrderRow,
  filters: GstFilingFilters
): { include: boolean; reason?: "online" | "offline" | "gst_excluded" } {
  const channel = shouldIncludeOrderChannel(order, filters)
  if (!channel.include) {
    return channel
  }

  if (!isGstFilingIncluded(order.metadata)) {
    return { include: false, reason: "gst_excluded" }
  }

  return { include: true }
}

export function buildGstr1FromOrders(
  orders: GstFilingOrderRow[],
  config: Gstr1BuildConfig
): { gstr1: Record<string, unknown>; summary: Gstr1FilingSummary } {
  const filters = config.filters ?? {}
  const supplierState = supplierStateFromGstin(config.gstin)
  const fp = formatFp(config.month, config.year)
  const defaultHsn = config.defaultHsn ?? "33030010"
  const b2clThreshold = config.b2clThresholdInr ?? B2CL_THRESHOLD_INR
  const rate = gstRatePercent()

  const b2csMap = new Map<
    B2csKey,
    { sply_ty: "INTRA" | "INTER"; pos: string; txval: number; iamt: number; camt: number; samt: number }
  >()
  const b2clByPos = new Map<string, Array<Record<string, unknown>>>()
  const hsnMap = new Map<
    string,
    { txval: number; qty: number; iamt: number; camt: number; samt: number; desc: string }
  >()

  let orderCount = 0
  let offlineOrderCount = 0
  let onlineOrderCount = 0
  let skippedCanceled = 0
  let skippedNonIndia = 0
  let skippedOnline = 0
  let skippedOffline = 0
  let skippedGstExcluded = 0
  let skippedZeroTotal = 0
  let totalTaxable = 0
  let totalTax = 0
  let totalInvoiceValue = 0
  let b2clCount = 0
  let hsnTaxable = 0

  const displayIds: number[] = []

  for (const order of orders) {
    if (order.canceled_at) {
      skippedCanceled++
      continue
    }

    const country = order.shipping_address?.country_code?.toLowerCase() ?? "in"
    const isOffline = isOfflineSaleOrder(order.metadata)
    if (!isOffline && country !== "in") {
      skippedNonIndia++
      continue
    }

    const inclusion = shouldIncludeOrderForGst(order, filters)
    if (!inclusion.include) {
      if (inclusion.reason === "online") skippedOnline++
      if (inclusion.reason === "offline") skippedOffline++
      if (inclusion.reason === "gst_excluded") skippedGstExcluded++
      continue
    }

    const { txval, tax, total } = orderGstrAmounts(order)
    if (total <= 0) {
      skippedZeroTotal++
      continue
    }

    orderCount++
    if (isOffline) {
      offlineOrderCount++
    } else {
      onlineOrderCount++
    }
    totalTaxable += txval
    totalTax += tax
    totalInvoiceValue += total

    const displayNum = Number(order.display_id)
    if (Number.isFinite(displayNum)) {
      displayIds.push(displayNum)
    }

    const pos = resolvePlaceOfSupply({
      province:
        order.shipping_address?.province ??
        (isOffline
          ? (order.metadata?.store_location as string | undefined)
          : undefined),
      postalCode: order.shipping_address?.postal_code,
      countryCode: isOffline ? "in" : country,
      fallbackStateCode: supplierState,
    })

    const isIntra = pos === supplierState
    const sply_ty = isIntra ? "INTRA" : "INTER"
    const taxSplit = splitTaxAmount(tax, isIntra)

    const breakdown = computeOrderGstBreakdown(order)
    const medusaItemSub = Number(order.item_subtotal ?? 0)
    const gstrScale =
      medusaItemSub > 0 && breakdown.discount > 0
        ? breakdown.gstr_taxable / medusaItemSub
        : 1

    if (!isIntra && total > b2clThreshold) {
      b2clCount++
      const posInvoices = b2clByPos.get(pos) ?? []
      posInvoices.push({
        inum: orderInvoiceNumber(order.display_id),
        idt: formatInvoiceDate(order.created_at),
        val: total,
        pos,
        itms: [
          {
            num: 1,
            itm_det: {
              rt: rate,
              txval,
              iamt: taxSplit.iamt,
              csamt: 0,
            },
          },
        ],
      })
      b2clByPos.set(pos, posInvoices)
    } else {
      const key: B2csKey = `${sply_ty}|${pos}|${rate}`
      const existing = b2csMap.get(key) ?? {
        sply_ty,
        pos,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
      }
      existing.txval = round2(existing.txval + txval)
      existing.iamt = round2(existing.iamt + taxSplit.iamt)
      existing.camt = round2(existing.camt + taxSplit.camt)
      existing.samt = round2(existing.samt + taxSplit.samt)
      b2csMap.set(key, existing)
    }

    for (const line of order.items ?? []) {
      accumulateHsnLine({
        line,
        order,
        isIntra,
        defaultHsn,
        gstrScale,
        hsnMap,
        onTaxable: (value) => {
          hsnTaxable += value
        },
      })
    }
  }

  const b2cs = Array.from(b2csMap.values()).map((row) => {
    const entry: Record<string, unknown> = {
      sply_ty: row.sply_ty,
      typ: "OE",
      pos: row.pos,
      rt: rate,
      txval: row.txval,
      csamt: 0,
    }

    if (row.sply_ty === "INTER") {
      entry.iamt = row.iamt
    } else {
      entry.camt = row.camt
      entry.samt = row.samt
    }

    return entry
  })

  const b2cl = Array.from(b2clByPos.entries()).map(([pos, inv]) => ({
    pos,
    inv,
  }))

  const hsnData = Array.from(hsnMap.entries()).map(([hsn_sc, row], index) => ({
    num: index + 1,
    hsn_sc,
    desc: row.desc.slice(0, 30),
    uqc: "NOS",
    qty: row.qty,
    rt: rate,
    txval: row.txval,
    iamt: row.iamt,
    camt: row.camt,
    samt: row.samt,
    csamt: 0,
  }))

  displayIds.sort((a, b) => a - b)
  const docIssue =
    displayIds.length > 0
      ? {
          doc_det: [
            {
              doc_num: 1,
              docs: [
                {
                  num: 1,
                  from: String(displayIds[0]),
                  to: String(displayIds[displayIds.length - 1]),
                  totnum: displayIds.length,
                  cancel: 0,
                  net_issue: displayIds.length,
                },
              ],
            },
          ],
        }
      : undefined

  const gstr1: Record<string, unknown> = {
    gstin: config.gstin.toUpperCase(),
    fp,
    version: "GST3.2.1",
    gt: round2(totalInvoiceValue),
    cur_gt: round2(totalInvoiceValue),
  }

  if (b2cs.length) {
    gstr1.b2cs = b2cs
  }

  if (b2cl.length) {
    gstr1.b2cl = b2cl
  }

  if (hsnData.length) {
    gstr1.hsn = { data: hsnData }
  }

  if (docIssue) {
    gstr1.doc_issue = docIssue
  }

  const itemTaxableTotal = round2(
    orders.reduce((sum, order) => {
      if (order.canceled_at || !shouldIncludeOrderForGst(order, filters).include) {
        return sum
      }
      return sum + orderGstrAmounts(order).txval
    }, 0)
  )

  const totalsConsistent =
    hsnData.length === 0 || Math.abs(hsnTaxable - itemTaxableTotal) < 1

  return {
    gstr1,
    summary: {
      gstin: config.gstin.toUpperCase(),
      filing_period: fp,
      orders_in_period: orders.length,
      order_count: orderCount,
      offline_order_count: offlineOrderCount,
      online_order_count: onlineOrderCount,
      skipped_zero_total: skippedZeroTotal,
      skipped_canceled: skippedCanceled,
      skipped_non_india: skippedNonIndia,
      skipped_online: skippedOnline,
      skipped_offline: skippedOffline,
      skipped_gst_excluded: skippedGstExcluded,
      skipped_ignore_sales: Boolean(filters.ignoreSales),
      total_taxable_inr: round2(totalTaxable),
      total_tax_inr: round2(totalTax),
      total_invoice_value_inr: round2(totalInvoiceValue),
      b2cs_aggregate_lines: b2cs.length,
      b2cl_invoices: b2clCount,
      hsn_lines: hsnData.length,
      hsn_taxable_inr: round2(hsnTaxable),
      totals_consistent: totalsConsistent,
    },
  }
}

export function gstr1DownloadFilename(
  gstin: string,
  month: number,
  year: number
): string {
  const fp = formatFp(month, year)
  return `returns_${fp}_Returns_${gstin.toUpperCase()}_offline.json`
}

export function fullReportDownloadFilename(
  gstin: string,
  month: number,
  year: number
): string {
  const fp = formatFp(month, year)
  return `gst_report_${fp}_${gstin.toUpperCase()}.json`
}
