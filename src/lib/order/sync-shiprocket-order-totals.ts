import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  resolveCorrectOrderShippingInr,
  shiprocketRateToMedusaShippingAmount,
} from "../currency/inr-amounts"

type RawAmount = { value: string; precision: number }

function toRawAmount(value: number): RawAmount {
  return { value: String(value), precision: 20 }
}

function shippingAmountFromMethodData(
  data: Record<string, unknown> | null | undefined
): number | null {
  const rate = data?.shiprocket_rate_inr
  if (rate != null && Number.isFinite(Number(rate))) {
    return shiprocketRateToMedusaShippingAmount(Number(rate))
  }
  return null
}

type OrderRow = {
  id: string
  display_id?: number | string
  currency_code?: string | null
  item_total?: number | null
  item_subtotal?: number | null
  item_tax_total?: number | null
  shipping_total?: number | null
  total?: number | null
  metadata?: Record<string, unknown> | null
  shipping_methods?: Array<{
    id: string
    name?: string | null
    amount?: number | null
    data?: Record<string, unknown> | null
  }> | null
}

/**
 * Medusa cart.complete often keeps Standard Shipping (₹99) on the order while
 * checkout charged Razorpay using the Shiprocket rate from cart metadata (~₹47).
 * Rewrites order + payment collection totals to match Shiprocket / Razorpay.
 */
export async function syncShiprocketOrderTotals(
  container: MedusaContainer,
  orderId: string
): Promise<boolean> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "currency_code",
      "item_total",
      "item_subtotal",
      "item_tax_total",
      "shipping_total",
      "total",
      "metadata",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.amount",
      "shipping_methods.data",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0] as OrderRow | undefined
  if (!order?.id || order.currency_code?.toLowerCase() !== "inr") {
    return false
  }

  const shiprocket = order.metadata?.shiprocket as { rate_inr?: number } | undefined
  if (shiprocket?.rate_inr == null || !Number.isFinite(shiprocket.rate_inr)) {
    return false
  }

  const itemTotal = Number(order.item_total ?? 0)
  const methods = order.shipping_methods ?? []
  const method = methods[0]

  if (!method?.id) {
    return false
  }

  const fromData = shippingAmountFromMethodData(method.data)
  const correctedShipping =
    fromData ??
    resolveCorrectOrderShippingInr({
      shippingAmount: Number(method.amount ?? order.shipping_total ?? 0),
      itemTotal,
      shippingMethodName: method.name,
      metadata: order.metadata,
    })

  const razorpayCharged = Number(order.metadata?.razorpay_charged_amount_inr)
  let newTotal =
    Number.isFinite(razorpayCharged) && razorpayCharged > 0
      ? Math.round(razorpayCharged * 100) / 100
      : Math.round((itemTotal + correctedShipping) * 100) / 100

  const currentTotal = Number(order.total ?? 0)
  const currentShipping = Number(method.amount ?? order.shipping_total ?? 0)

  if (
    Math.abs(currentTotal - newTotal) < 0.02 &&
    Math.abs(currentShipping - correctedShipping) < 0.02
  ) {
    return false
  }

  console.info(
    `[sync-shiprocket-totals] Order #${order.display_id}: shipping ${currentShipping} → ${correctedShipping}, total ${currentTotal} → ${newTotal}`
  )

  await pg("order_shipping_method")
    .where("id", method.id)
    .update({
      amount: correctedShipping,
      raw_amount: JSON.stringify(toRawAmount(correctedShipping)),
      updated_at: pg.fn.now(),
    })

  const summaryRow = await pg("order_summary")
    .where("order_id", order.id)
    .whereNull("deleted_at")
    .orderBy("version", "desc")
    .first()

  if (summaryRow?.totals) {
    const totals =
      typeof summaryRow.totals === "string"
        ? JSON.parse(summaryRow.totals)
        : { ...summaryRow.totals }

    totals.current_order_total = newTotal
    totals.original_order_total = newTotal
    totals.accounting_total = newTotal
    totals.paid_total = newTotal
    totals.pending_difference = 0
    totals.raw_current_order_total = toRawAmount(newTotal)
    totals.raw_original_order_total = toRawAmount(newTotal)
    totals.raw_accounting_total = toRawAmount(newTotal)
    totals.raw_paid_total = toRawAmount(newTotal)
    totals.raw_pending_difference = toRawAmount(0)

    await pg("order_summary")
      .where("id", summaryRow.id)
      .update({
        totals: JSON.stringify(totals),
        updated_at: pg.fn.now(),
      })
  }

  const paymentLinks = await pg("order_payment_collection").where(
    "order_id",
    order.id
  )

  for (const link of paymentLinks) {
    const pcId = link.payment_collection_id

    await pg("payment_collection")
      .where("id", pcId)
      .update({
        amount: newTotal,
        raw_amount: JSON.stringify(toRawAmount(newTotal)),
        authorized_amount: newTotal,
        raw_authorized_amount: JSON.stringify(toRawAmount(newTotal)),
        updated_at: pg.fn.now(),
      })

    await pg("payment_session")
      .where("payment_collection_id", pcId)
      .update({
        amount: newTotal,
        raw_amount: JSON.stringify(toRawAmount(newTotal)),
        updated_at: pg.fn.now(),
      })

    await pg("payment")
      .where("payment_collection_id", pcId)
      .update({
        amount: newTotal,
        raw_amount: JSON.stringify(toRawAmount(newTotal)),
        updated_at: pg.fn.now(),
      })
  }

  return true
}
