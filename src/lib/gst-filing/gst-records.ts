import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  type GstFilingFilters,
  type GstFilingOrderRow,
  shouldIncludeOrderChannel,
} from "./build-gstr1-json"
import { loadOrdersForGstPeriod } from "./load-orders-for-period"
import {
  computeOrderGstBreakdown,
  formatOrderDate,
  isGstFilingIncluded,
} from "./order-gst-amounts"
import { isOfflineSaleOrder } from "./period"

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

export type GstRecordsResponse = {
  records: GstSaleRecord[]
  counts: {
    total: number
    included: number
    excluded: number
    offline: number
    online: number
  }
}

function customerLabel(order: GstFilingOrderRow): string {
  const meta = order.metadata
  if (typeof meta?.customer_name === "string" && meta.customer_name.trim()) {
    return meta.customer_name.trim()
  }
  return "Customer"
}

export function buildGstSaleRecords(
  orders: GstFilingOrderRow[],
  filters: GstFilingFilters = {}
): GstRecordsResponse {
  const records: GstSaleRecord[] = []

  for (const order of orders) {
    if (order.canceled_at) {
      continue
    }

    const isOffline = isOfflineSaleOrder(order.metadata)
    const country = order.shipping_address?.country_code?.toLowerCase() ?? "in"
    if (!isOffline && country !== "in") {
      continue
    }

    const inclusion = shouldIncludeOrderChannel(order, filters)
    if (!inclusion.include) {
      continue
    }

    const breakdown = computeOrderGstBreakdown(order)
    const hasZeroTotal = breakdown.gstr_total <= 0

    records.push({
      order_id: order.id,
      display_id: order.display_id ?? null,
      created_at: formatOrderDate(order.created_at),
      channel: isOffline ? "offline" : "online",
      customer_label: customerLabel(order),
      list_total_inr: breakdown.list_total,
      discount_inr: breakdown.discount,
      paid_total_inr: breakdown.paid_total,
      taxable_inr: breakdown.gstr_taxable,
      gst_inr: breakdown.gstr_gst,
      include_in_gst: isGstFilingIncluded(order.metadata) && !hasZeroTotal,
      has_zero_total: hasZeroTotal,
    })
  }

  records.sort((a, b) => {
    const aId = Number(a.display_id)
    const bId = Number(b.display_id)
    if (Number.isFinite(aId) && Number.isFinite(bId)) {
      return aId - bId
    }
    return a.created_at.localeCompare(b.created_at)
  })

  return {
    records,
    counts: {
      total: records.length,
      included: records.filter((r) => r.include_in_gst).length,
      excluded: records.filter((r) => !r.include_in_gst).length,
      offline: records.filter((r) => r.channel === "offline").length,
      online: records.filter((r) => r.channel === "online").length,
    },
  }
}

export async function loadGstSaleRecords(
  container: MedusaContainer,
  input: {
    year: number
    month: number
    filters?: GstFilingFilters
  }
): Promise<GstRecordsResponse> {
  const orders = await loadOrdersForGstPeriod(
    container,
    input.year,
    input.month
  )
  return buildGstSaleRecords(orders, input.filters ?? {})
}

export async function updateGstRecordInclusion(
  container: MedusaContainer,
  updates: Array<{ order_id: string; include: boolean }>
): Promise<{ updated: number }> {
  const orderModule = container.resolve(Modules.ORDER) as {
    retrieveOrder: (id: string) => Promise<{ metadata?: Record<string, unknown> | null }>
    updateOrders: (
      id: string,
      data: { metadata: Record<string, unknown> }
    ) => Promise<unknown>
  }

  let updated = 0

  for (const row of updates) {
    if (!row.order_id) {
      continue
    }

    const order = await orderModule.retrieveOrder(row.order_id)
    await orderModule.updateOrders(row.order_id, {
      metadata: {
        ...(order.metadata ?? {}),
        gst_filing_include: row.include,
      },
    })
    updated++
  }

  return { updated }
}
