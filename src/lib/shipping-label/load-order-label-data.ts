import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveCorrectOrderShippingInr } from "../currency/inr-amounts"
import { orderChannelBarcode } from "./metadata"

export type LabelLineItem = {
  title: string
  sku?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type OrderLabelData = {
  orderId: string
  displayId: number | string
  orderBarcode: string
  orderDate: string
  paymentMode: "Prepaid" | "COD"
  itemSubtotal: number
  shippingTotal: number
  orderTotal: number
  currencyCode: string
  weightKg: number
  awb?: string
  courier?: string
  customer: {
    name: string
    phone?: string
    email?: string
    addressLines: string[]
    city?: string
    province?: string
    postalCode?: string
    country?: string
  }
  shipFrom: {
    name: string
    phone?: string
    email?: string
    addressLines: string[]
    city?: string
    province?: string
    postalCode?: string
    country?: string
  }
  items: LabelLineItem[]
  supportPhone: string
  supportEmail: string
  brandName: string
}

function formatAddressLines(input: {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
}): string[] {
  const lines: string[] = []
  if (input.address_1) lines.push(input.address_1)
  if (input.address_2) lines.push(input.address_2)
  const cityLine = [input.city, input.province, input.postal_code]
    .filter(Boolean)
    .join(", ")
  if (cityLine) lines.push(cityLine)
  if (input.country_code) {
    lines.push(input.country_code.toUpperCase() === "IN" ? "India" : input.country_code)
  }
  return lines
}

export async function loadOrderLabelData(
  container: MedusaContainer,
  orderId: string
): Promise<OrderLabelData> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Totals must be loaded without line-item fields — Medusa's graph query returns
  // wrong order.total / item_total when items.* is in the same request.
  const { data: headerRows } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "item_total",
      "shipping_total",
      "metadata",
      "summary.current_order_total",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.phone",
      "shipping_address.address_1",
      "shipping_address.address_2",
      "shipping_address.city",
      "shipping_address.province",
      "shipping_address.postal_code",
      "shipping_address.country_code",
      "shipping_methods.name",
      "shipping_methods.amount",
      "payment_collections.status",
      "payment_collections.amount",
      "created_at",
    ],
    filters: { id: orderId },
  })

  const order = headerRows?.[0] as
    | {
        id: string
        display_id?: number | string
        email?: string | null
        currency_code?: string
        total?: number
        item_total?: number
        shipping_total?: number
        created_at?: string | Date
        metadata?: Record<string, unknown> | null
        summary?: { current_order_total?: number } | null
        shipping_address?: Record<string, string | null | undefined> | null
        shipping_methods?: Array<{
          name?: string | null
          amount?: number | string | null
        }> | null
        payment_collections?: Array<{ status?: string; amount?: number }> | null
      }
    | undefined

  if (!order) {
    throw new Error("Order not found")
  }

  const { data: lineRows } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "items.title",
      "items.product_title",
      "items.variant_sku",
      "items.quantity",
      "items.unit_price",
      "items.detail.quantity",
      "items.detail.unit_price",
      "items.detail.subtotal",
      "items.detail.total",
    ],
    filters: { id: orderId },
  })

  const lineOrder = lineRows?.[0] as
    | {
        items?: Array<{
          title?: string | null
          product_title?: string | null
          variant_sku?: string | null
          quantity?: number | string | null
          unit_price?: number | string | null
          detail?: {
            quantity?: number | string | null
            unit_price?: number | string | null
            subtotal?: number | string | null
            total?: number | string | null
          } | null
        }> | null
      }
    | undefined

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "address.address_1",
      "address.address_2",
      "address.city",
      "address.province",
      "address.postal_code",
      "address.country_code",
      "address.phone",
    ],
  })

  const pickup =
    (locations as Array<{
      name?: string
      address?: Record<string, string | null | undefined>
    }> | undefined)?.[0] ?? {}

  const shiprocket = (order.metadata?.shiprocket ?? {}) as Record<string, unknown>
  const shipping = order.shipping_address ?? {}
  const displayId = order.display_id ?? order.id.slice(-6)
  const customerName =
    [shipping.first_name, shipping.last_name].filter(Boolean).join(" ") ||
    "Customer"

  const items: LabelLineItem[] =
    lineOrder?.items?.map((line) => {
      const quantity = Number(line.detail?.quantity ?? line.quantity ?? 1)
      const unitPrice = Number(
        line.detail?.unit_price ?? line.unit_price ?? 0
      )
      const detailTotal = Number(line.detail?.total ?? line.detail?.subtotal ?? 0)
      const lineTotal =
        detailTotal > 0
          ? detailTotal
          : Math.round(unitPrice * quantity * 100) / 100
      return {
        title: line.title ?? line.product_title ?? "Item",
        sku: line.variant_sku ?? undefined,
        quantity,
        unitPrice,
        lineTotal,
      }
    }) ?? []

  const itemSubtotal =
    Number(order.item_total ?? 0) > 0
      ? Number(order.item_total)
      : items.reduce((sum, line) => sum + line.lineTotal, 0)

  const shippingMethod = order.shipping_methods?.[0]
  const shippingTotal = resolveCorrectOrderShippingInr({
    shippingAmount: Number(
      shippingMethod?.amount ?? order.shipping_total ?? 0
    ),
    itemTotal: itemSubtotal,
    shippingMethodName: shippingMethod?.name,
    metadata: order.metadata,
  })

  const orderTotal = Number(
    order.summary?.current_order_total ?? order.total ?? 0
  )

  const isPrepaid =
    order.metadata?.wt_payment === "razorpay" ||
    order.payment_collections?.some((pc) =>
      ["authorized", "completed", "paid"].includes(String(pc.status ?? ""))
    )

  return {
    orderId: order.id,
    displayId,
    orderBarcode: orderChannelBarcode(displayId),
    orderDate: new Date(order.created_at ?? Date.now()).toISOString().slice(0, 10),
    paymentMode: isPrepaid ? "Prepaid" : "COD",
    itemSubtotal,
    shippingTotal,
    orderTotal,
    currencyCode: (order.currency_code ?? "inr").toUpperCase(),
    weightKg: Number(shiprocket.weight_kg ?? process.env.SHIPROCKET_DEFAULT_WEIGHT_KG ?? 0.35),
    awb: typeof shiprocket.awb === "string" ? shiprocket.awb : undefined,
    courier: typeof shiprocket.courier_name === "string" ? shiprocket.courier_name : undefined,
    customer: {
      name: customerName,
      phone: shipping.phone ?? undefined,
      email: order.email ?? undefined,
      addressLines: formatAddressLines(shipping),
      city: shipping.city ?? undefined,
      province: shipping.province ?? undefined,
      postalCode: shipping.postal_code ?? undefined,
      country: shipping.country_code ?? undefined,
    },
    shipFrom: {
      name: pickup.name ?? process.env.SHOP_NAME ?? "Whiff Theory",
      phone: pickup.address?.phone ?? process.env.SHOP_SUPPORT_PHONE ?? undefined,
      email: process.env.SHOP_SUPPORT_EMAIL ?? "hello@whiff-theory.com",
      addressLines: formatAddressLines(pickup.address ?? {}),
      city: pickup.address?.city ?? undefined,
      province: pickup.address?.province ?? undefined,
      postalCode: pickup.address?.postal_code ?? undefined,
      country: pickup.address?.country_code ?? "IN",
    },
    items,
    supportPhone: process.env.SHOP_SUPPORT_PHONE ?? "+91 79810 75481",
    supportEmail: process.env.SHOP_SUPPORT_EMAIL ?? "hello@whiff-theory.com",
    brandName: process.env.SHOP_NAME ?? "Whiff Theory",
  }
}
