import { splitTaxInclusiveAmount } from "../currency/inr-amounts"
import type { GstFilingOrderRow } from "./build-gstr1-json"
import { isOfflineSaleOrder } from "./period"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export type OrderGstBreakdown = {
  list_total: number
  paid_total: number
  discount: number
  taxable: number
  gst: number
  total: number
  gstr_taxable: number
  gstr_gst: number
  gstr_total: number
}

/** Default true — only explicit `false` excludes an order from GST filing. */
export function isGstFilingIncluded(
  metadata?: Record<string, unknown> | null
): boolean {
  if (metadata?.gst_filing_include === false) {
    return false
  }
  return true
}

function sumLineListPrices(order: GstFilingOrderRow): number {
  return round2(
    (order.items ?? []).reduce((sum, line) => {
      const qty = Number(line.quantity ?? 1)
      const unit = Number(line.unit_price ?? 0)
      return sum + unit * qty
    }, 0)
  )
}

function medusaOrderAmounts(order: GstFilingOrderRow): OrderGstBreakdown {
  const itemSub = Number(order.item_subtotal ?? 0)
  const itemTax = Number(order.item_tax_total ?? 0)
  const shipSub = Number(order.shipping_subtotal ?? 0)
  const shipTax = Number(order.shipping_tax_total ?? 0)

  if (itemSub > 0 || shipSub > 0) {
    const taxable = round2(itemSub + shipSub)
    const gst = round2(itemTax + shipTax)
    const total = round2(taxable + gst)
    return {
      list_total: total,
      paid_total: total,
      discount: 0,
      taxable,
      gst,
      total,
      gstr_taxable: taxable,
      gstr_gst: gst,
      gstr_total: total,
    }
  }

  const summaryTotal = Number(order.summary?.current_order_total ?? 0)
  const storedTotal = Number(order.total ?? 0)
  let total = storedTotal > 0 ? storedTotal : summaryTotal

  if (isOfflineSaleOrder(order.metadata)) {
    const paidAmount = Number(order.metadata?.paid_amount ?? 0)
    if (paidAmount > 0 && total <= 0) {
      total = paidAmount
    }
  }

  if (total <= 0) {
    return {
      list_total: 0,
      paid_total: 0,
      discount: 0,
      taxable: 0,
      gst: 0,
      total: 0,
      gstr_taxable: 0,
      gstr_gst: 0,
      gstr_total: 0,
    }
  }

  const parts = splitTaxInclusiveAmount(total)
  return {
    list_total: total,
    paid_total: total,
    discount: 0,
    taxable: parts.subtotal,
    gst: parts.tax,
    total,
    gstr_taxable: parts.subtotal,
    gstr_gst: parts.tax,
    gstr_total: total,
  }
}

/**
 * Display + GSTR amounts. Offline sales with a discount use paid_amount for GST.
 */
export function computeOrderGstBreakdown(
  order: GstFilingOrderRow
): OrderGstBreakdown {
  const meta = order.metadata
  const isOffline = isOfflineSaleOrder(meta)
  const paidAmount = Number(meta?.paid_amount ?? 0)
  const originalTotal = Number(meta?.original_total ?? 0)
  const discountApplied = Number(meta?.discount_applied ?? 0)
  const lineList = sumLineListPrices(order)
  const fromMedusa = medusaOrderAmounts(order)

  const listTotal =
    originalTotal > 0 ? originalTotal : lineList > 0 ? lineList : fromMedusa.total

  if (isOffline && paidAmount > 0) {
    const discount =
      discountApplied > 0
        ? discountApplied
        : round2(Math.max(0, listTotal - paidAmount))
    const paidParts = splitTaxInclusiveAmount(paidAmount)

    return {
      list_total: listTotal,
      paid_total: paidAmount,
      discount,
      taxable: paidParts.subtotal,
      gst: paidParts.tax,
      total: paidAmount,
      gstr_taxable: paidParts.subtotal,
      gstr_gst: paidParts.tax,
      gstr_total: paidAmount,
    }
  }

  return {
    ...fromMedusa,
    list_total: listTotal > 0 ? listTotal : fromMedusa.total,
    paid_total: fromMedusa.total,
    discount: discountApplied,
    gstr_taxable: fromMedusa.gstr_taxable,
    gstr_gst: fromMedusa.gstr_gst,
    gstr_total: fromMedusa.gstr_total,
  }
}

export function orderGstrAmounts(order: GstFilingOrderRow): {
  txval: number
  tax: number
  total: number
} {
  const breakdown = computeOrderGstBreakdown(order)
  return {
    txval: breakdown.gstr_taxable,
    tax: breakdown.gstr_gst,
    total: breakdown.gstr_total,
  }
}

export function formatOrderDate(value?: string | Date | null): string {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-IN")
}
