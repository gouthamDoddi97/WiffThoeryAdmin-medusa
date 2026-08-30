import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { syncShiprocketOrderTotals } from "../lib/order/sync-shiprocket-order-totals"

/**
 * Re-align a placed order's totals with Shiprocket / Razorpay metadata.
 *
 * Run: npx medusa exec ./src/scripts/sync-order-shiprocket-totals.ts 20
 */
export default async function syncOrderShiprocketTotalsScript({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const displayIdArg = process.argv.find((a) => /^\d+$/.test(a))
  const displayId = displayIdArg ? Number(displayIdArg) : undefined

  if (!displayId) {
    logger.error("Usage: npx medusa exec ./src/scripts/sync-order-shiprocket-totals.ts <display_id>")
    return
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { display_id: String(displayId) },
  })

  const order = orders?.[0] as
    | { id?: string; display_id?: string; metadata?: Record<string, unknown> | null }
    | undefined
  if (!order?.id) {
    logger.error(`Order #${displayId} not found`)
    return
  }

  const metadata = order.metadata
  if (!metadata?.razorpay_charged_amount_inr && !(metadata?.shiprocket as { rate_inr?: number })?.rate_inr) {
    logger.warn(
      `Order #${displayId} has no shiprocket.rate_inr or razorpay_charged_amount_inr — set metadata first if needed`
    )
  }

  const updated = await syncShiprocketOrderTotals(container, order.id)
  logger.info(updated ? `Order #${displayId} totals updated` : `Order #${displayId} already aligned`)
}
