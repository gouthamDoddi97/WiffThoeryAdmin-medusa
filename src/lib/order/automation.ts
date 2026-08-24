import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  capturePaymentWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"
import { syncShiprocketOrderTotals } from "./sync-shiprocket-order-totals"

type OrderAutomationRow = {
  id: string
  metadata?: Record<string, unknown> | null
  items?: Array<{ id?: string; quantity?: number | string | null }> | null
  fulfillments?: Array<{
    id?: string
    shipped_at?: string | Date | null
    delivered_at?: string | Date | null
  }> | null
  payment_collections?: Array<{
    id?: string
    status?: string
    payments?: Array<{
      id?: string
      captured_at?: string | Date | null
      amount?: number | string
    }> | null
  }> | null
}

function storefrontTrackingUrl(awb: string): string {
  const base = (process.env.STOREFRONT_URL ?? "https://www.whiff-theory.com").replace(
    /\/+$/,
    ""
  )
  return `${base}/in/track/${encodeURIComponent(awb)}`
}

export function isRazorpayPrepaidOrder(
  metadata?: Record<string, unknown> | null
): boolean {
  return (
    metadata?.wt_payment === "razorpay" &&
    typeof metadata?.razorpay_payment_id === "string" &&
    metadata.razorpay_payment_id.length > 0
  )
}

async function loadOrderForAutomation(
  container: MedusaContainer,
  orderId: string
): Promise<OrderAutomationRow | undefined> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "metadata",
      "items.id",
      "items.quantity",
      "fulfillments.id",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.payments.id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.amount",
    ],
    filters: { id: orderId },
  })

  return orders?.[0] as OrderAutomationRow | undefined
}

/**
 * Razorpay already captured funds — tell Medusa the order is paid (no admin "Capture payment").
 */
export async function captureRazorpayOrderPayment(
  container: MedusaContainer,
  orderId: string
): Promise<boolean> {
  const order = await loadOrderForAutomation(container, orderId)
  if (!order || !isRazorpayPrepaidOrder(order.metadata)) {
    return false
  }

  const payment = order.payment_collections
    ?.flatMap((pc) => pc.payments ?? [])
    .find((p) => p.id && !p.captured_at)

  if (!payment?.id) {
    return false
  }

  await capturePaymentWorkflow(container).run({
    input: {
      payment_id: payment.id,
      captured_by: "razorpay:auto",
    },
  })

  console.info(`[order-automation] Captured payment ${payment.id} for order ${orderId}`)
  return true
}

/**
 * Create fulfillment = "we will ship these items" (packing list / warehouse step).
 * Required before Medusa can mark shipped or delivered.
 */
export async function ensureOrderFulfillment(
  container: MedusaContainer,
  orderId: string
): Promise<string | null> {
  const order = await loadOrderForAutomation(container, orderId)
  if (!order) {
    return null
  }

  const existing = order.fulfillments?.find((f) => f.id)
  if (existing?.id) {
    return existing.id
  }

  const items =
    order.items
      ?.filter((item) => item.id && Number(item.quantity ?? 0) > 0)
      .map((item) => ({
        id: item.id!,
        quantity: Number(item.quantity ?? 1),
      })) ?? []

  if (!items.length) {
    console.warn(`[order-automation] Order ${orderId} has no items to fulfill`)
    return null
  }

  const { result } = await createOrderFulfillmentWorkflow(container).run({
    input: {
      order_id: orderId,
      items,
      no_notification: false,
    },
  })

  const fulfillmentId = result?.id ?? null
  if (fulfillmentId) {
    console.info(
      `[order-automation] Created fulfillment ${fulfillmentId} for order ${orderId}`
    )
  }
  return fulfillmentId
}

export async function markOrderShippedFromTracking(
  container: MedusaContainer,
  orderId: string,
  input: { awb: string; courier?: string }
): Promise<boolean> {
  const order = await loadOrderForAutomation(container, orderId)
  if (!order) {
    return false
  }

  const shiprocket = (order.metadata?.shiprocket ?? {}) as Record<string, unknown>
  if (shiprocket.medusa_shipment_registered_at) {
    return false
  }

  let fulfillmentId = order.fulfillments?.find((f) => f.id && !f.shipped_at)?.id
  if (!fulfillmentId) {
    console.info(
      `[order-automation] Order ${orderId} has no fulfillment yet — create fulfillment in Admin after packing before shipped status can sync`
    )
    return false
  }

  const orderForShipment = order

  const items =
    orderForShipment.items
      ?.filter((item) => item.id && Number(item.quantity ?? 0) > 0)
      .map((item) => ({
        id: item.id!,
        quantity: Number(item.quantity ?? 1),
      })) ?? []

  if (!items.length) {
    return false
  }

  const awb = input.awb.trim()
  await createOrderShipmentWorkflow(container).run({
    input: {
      order_id: orderId,
      fulfillment_id: fulfillmentId,
      items,
      labels: [
        {
          tracking_number: awb,
          tracking_url: storefrontTrackingUrl(awb),
          label_url: storefrontTrackingUrl(awb),
        },
      ],
      no_notification: true,
      metadata: {
        shiprocket_awb: awb,
        shiprocket_courier: input.courier,
        source: "shiprocket-webhook",
      },
    },
  })

  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders(orderId, {
    metadata: {
      ...(order.metadata ?? {}),
      shiprocket: {
        ...shiprocket,
        medusa_shipment_registered_at: new Date().toISOString(),
      },
    },
  })

  console.info(
    `[order-automation] Registered shipment for order ${orderId} (AWB ${awb})`
  )
  return true
}

export async function markOrderDeliveredFromTracking(
  container: MedusaContainer,
  orderId: string
): Promise<boolean> {
  const order = await loadOrderForAutomation(container, orderId)
  if (!order) {
    return false
  }

  const shiprocket = (order.metadata?.shiprocket ?? {}) as Record<string, unknown>
  if (shiprocket.medusa_delivered_at) {
    return false
  }

  const fulfillment = order.fulfillments?.find(
    (f) => f.id && f.shipped_at && !f.delivered_at
  )
  if (!fulfillment?.id) {
    return false
  }

  await markOrderFulfillmentAsDeliveredWorkflow(container).run({
    input: {
      orderId,
      fulfillmentId: fulfillment.id,
    },
  })

  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders(orderId, {
    metadata: {
      ...(order.metadata ?? {}),
      shiprocket: {
        ...shiprocket,
        medusa_delivered_at: new Date().toISOString(),
      },
    },
  })

  console.info(`[order-automation] Marked order ${orderId} as delivered`)
  return true
}

export async function runRazorpayOrderAutomation(
  container: MedusaContainer,
  orderId: string
): Promise<void> {
  if (process.env.RAZORPAY_AUTO_CAPTURE_MEDUSA === "false") {
    return
  }

  const order = await loadOrderForAutomation(container, orderId)
  if (!order || !isRazorpayPrepaidOrder(order.metadata)) {
    return
  }

  try {
    await syncShiprocketOrderTotals(container, orderId)
  } catch (e) {
    console.error("[order-automation] Shiprocket total sync failed", e)
  }

  try {
    await captureRazorpayOrderPayment(container, orderId)
  } catch (e) {
    console.error("[order-automation] Payment capture failed", e)
  }

  // Fulfillment stays manual — pack order + stickers in Admin before shipping.
  if (process.env.AUTO_CREATE_FULFILLMENT === "true") {
    try {
      await ensureOrderFulfillment(container, orderId)
    } catch (e) {
      console.error("[order-automation] Auto-fulfillment failed", e)
    }
  }
}
