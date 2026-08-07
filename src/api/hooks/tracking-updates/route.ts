import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import type {
  INotificationModuleService,
  IOrderModuleService,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * Carrier tracking webhook (Shiprocket Panel → Settings → API → Webhook).
 *
 * URL must NOT contain: shiprocket, kartrocket, sr, or kr (Shiprocket panel rule).
 * Example: https://your-backend.up.railway.app/hooks/tracking-updates
 *
 * Auth: x-api-key header must match SHIPROCKET_WEBHOOK_TOKEN.
 */

type ShiprocketWebhookBody = {
  awb?: string | number
  awb_code?: string | number
  current_status?: string
  shipment_status?: string
  sr_status_label?: string
  order_id?: string
  channel_order_id?: string
  courier_name?: string
  etd?: string
  current_timestamp?: string
  scans?: Array<{ date?: string; activity?: string; location?: string; status?: string }>
}

const SHIPPED_STATUS_PATTERN = /picked|shipped|in transit|out for delivery|dispatched/i
const HISTORY_LIMIT = 30

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim()
  if (!expectedToken) {
    console.warn(
      "[tracking-webhook] SHIPROCKET_WEBHOOK_TOKEN not set — rejecting webhook"
    )
    res.status(503).json({ error: "Webhook not configured" })
    return
  }

  const providedToken = String(req.headers["x-api-key"] ?? "")
  if (providedToken !== expectedToken) {
    res.status(401).json({ error: "Invalid token" })
    return
  }

  const body = (req.body ?? {}) as ShiprocketWebhookBody
  const awb = String(body.awb ?? body.awb_code ?? "").trim()
  const status = String(
    body.current_status ?? body.shipment_status ?? body.sr_status_label ?? ""
  ).trim()
  const channelOrderId = String(
    body.order_id ?? body.channel_order_id ?? ""
  ).trim()

  const displayIdMatch = channelOrderId.match(/^WT-(\d+)$/i)
  if (!displayIdMatch) {
    console.warn(
      `[tracking-webhook] Unrecognized order_id "${channelOrderId}" (awb ${awb}, status ${status})`
    )
    res.json({ received: true })
    return
  }

  const displayId = displayIdMatch[1]
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "metadata"],
    filters: { display_id: displayId },
  })

  const order = orders?.[0]
  if (!order) {
    console.warn(
      `[tracking-webhook] No Medusa order for display id ${displayId} (awb ${awb})`
    )
    res.json({ received: true })
    return
  }

  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const existing = (order.metadata?.shiprocket ?? {}) as Record<string, unknown>
  const history = Array.isArray(existing.tracking_history)
    ? (existing.tracking_history as Array<Record<string, unknown>>)
    : []

  const updatedShiprocket: Record<string, unknown> = {
    ...existing,
    awb: awb || existing.awb,
    courier: body.courier_name ?? existing.courier,
    current_status: status || existing.current_status,
    etd: body.etd ?? existing.etd,
    status_updated_at: body.current_timestamp ?? new Date().toISOString(),
    tracking_history: [
      {
        status,
        at: body.current_timestamp ?? new Date().toISOString(),
        location: body.scans?.at(-1)?.location,
      },
      ...history,
    ].slice(0, HISTORY_LIMIT),
  }

  const shouldSendShippedEmail =
    Boolean(order.email) &&
    Boolean(awb || existing.awb) &&
    SHIPPED_STATUS_PATTERN.test(status) &&
    !existing.shipped_email_sent

  if (shouldSendShippedEmail) {
    try {
      const notificationService =
        req.scope.resolve<INotificationModuleService>(Modules.NOTIFICATION)

      await notificationService.createNotifications({
        to: order.email!,
        channel: "email",
        template: "order-shipped",
        data: {
          order,
          shipment: {
            awb: awb || String(existing.awb ?? ""),
            courier: body.courier_name ?? existing.courier,
            status,
            etd: body.etd ?? existing.etd,
          },
        },
      })

      updatedShiprocket.shipped_email_sent = true
      console.info(
        `[tracking-webhook] Shipped email sent for order ${order.display_id} (${status})`
      )
    } catch (e) {
      console.error("[tracking-webhook] Failed to send shipped email", e)
    }
  }

  try {
    await orderService.updateOrders(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        shiprocket: updatedShiprocket,
      },
    })
  } catch (e) {
    console.error("[tracking-webhook] Failed to update order metadata", e)
  }

  console.info(
    `[tracking-webhook] Order ${order.display_id}: ${status || "status update"} (awb ${awb})`
  )
  res.json({ received: true })
}
