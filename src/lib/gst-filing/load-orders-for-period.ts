import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { GstFilingOrderRow } from "./build-gstr1-json"
import { monthRangeUtc } from "./period"

const ORDER_HEADER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "canceled_at",
  "currency_code",
  "status",
  "total",
  "item_total",
  "item_subtotal",
  "item_tax_total",
  "tax_total",
  "shipping_subtotal",
  "shipping_tax_total",
  "metadata",
  "summary.current_order_total",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
]

const ORDER_LINE_FIELDS = [
  "id",
  "items.title",
  "items.product_title",
  "items.quantity",
  "items.unit_price",
  "items.subtotal",
  "items.tax_total",
  "items.detail.subtotal",
  "items.detail.tax_total",
  "items.detail.quantity",
  "items.detail.unit_price",
  "items.variant_sku",
]

type OrderHeaderRow = GstFilingOrderRow & {
  summary?: { current_order_total?: number | null } | null
}

type OrderLineRow = {
  id: string
  items?: GstFilingOrderRow["items"]
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

/**
 * Load orders for a GST period. Totals and line items are fetched separately —
 * Medusa's graph query returns wrong order.total when items.* is in the same request.
 */
export async function loadOrdersForGstPeriod(
  container: MedusaContainer,
  year: number,
  month: number
): Promise<GstFilingOrderRow[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { start, end } = monthRangeUtc(year, month)

  const { data: headers } = await query.graph({
    entity: "order",
    fields: ORDER_HEADER_FIELDS,
    filters: {
      created_at: {
        $gte: start.toISOString(),
        $lte: end.toISOString(),
      },
    },
    pagination: {
      take: 500,
      order: { created_at: "ASC" },
    },
  })

  const headerRows = (headers ?? []) as OrderHeaderRow[]
  if (!headerRows.length) {
    return []
  }

  const itemsByOrderId = new Map<string, GstFilingOrderRow["items"]>()

  for (const idChunk of chunk(
    headerRows.map((row) => row.id),
    50
  )) {
    const { data: lineRows } = await query.graph({
      entity: "order",
      fields: ORDER_LINE_FIELDS,
      filters: {
        id: { $in: idChunk },
      },
    })

    for (const row of (lineRows ?? []) as OrderLineRow[]) {
      itemsByOrderId.set(row.id, row.items ?? [])
    }
  }

  return headerRows.map((header) => ({
    ...header,
    total:
      header.total ??
      header.summary?.current_order_total ??
      header.total,
    items: itemsByOrderId.get(header.id) ?? [],
  }))
}

export function readGstFilingConfig(): {
  gstin: string
  defaultHsn: string
  b2clThresholdInr: number
} {
  const gstin = (process.env.GST_SUPPLIER_GSTIN ?? "").trim()
  const defaultHsn = (process.env.GST_DEFAULT_HSN ?? "33030010").trim()
  const b2clThresholdInr = Number(process.env.GST_B2CL_THRESHOLD_INR ?? "100000")

  return {
    gstin,
    defaultHsn,
    b2clThresholdInr: Number.isFinite(b2clThresholdInr)
      ? b2clThresholdInr
      : 100_000,
  }
}
