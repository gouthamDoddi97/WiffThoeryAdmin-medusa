import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  isShiprocketConfigured,
  isShiprocketDemoMode,
} from "../lib/integrations/config"

/**
 * Inspect recent orders for Shiprocket sync metadata.
 * Run: npx medusa exec ./src/scripts/inspect-order-shiprocket.ts
 */
export default async function inspectOrderShiprocket({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("── Shiprocket config ──")
  logger.info(`configured: ${isShiprocketConfigured()}`)
  logger.info(`demo_mode: ${isShiprocketDemoMode()}`)
  logger.info(`email set: ${Boolean(process.env.SHIPROCKET_EMAIL)}`)
  logger.info(
    `pickup: ${JSON.stringify(process.env.SHIPROCKET_PICKUP_LOCATION ?? "")}`
  )

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "metadata",
      "created_at",
      "*shipping_address",
      "*shipping_methods",
      "*items",
      "*customer",
    ],
    pagination: { take: 8, order: { created_at: "DESC" } },
  })

  for (const order of orders ?? []) {
    const meta = (order.metadata ?? {}) as Record<string, unknown>
    const sr = meta.shiprocket as Record<string, unknown> | undefined
    const shipping = order.shipping_address as
      | {
          address_1?: string
          city?: string
          postal_code?: string
          phone?: string
        }
      | null
      | undefined
    const customer = order.customer as { email?: string } | null | undefined

    logger.info(`── Order #${order.display_id} (${order.id}) ──`)
    logger.info(`order.email: ${order.email ?? "(none)"}`)
    logger.info(`customer.email: ${customer?.email ?? "(none)"}`)
    logger.info(
      `shipping: ${shipping?.address_1 ?? "(none)"}, ${shipping?.city ?? "?"}, ${shipping?.postal_code ?? "?"}, phone=${shipping?.phone ?? "(none)"}`
    )
    logger.info(
      `shipping_method: ${(order.shipping_methods as Array<{ name?: string }> | undefined)?.[0]?.name ?? "(none)"}`
    )
    logger.info(`items: ${(order.items as unknown[] | undefined)?.length ?? 0}`)
    logger.info(`metadata keys: ${Object.keys(meta).join(", ") || "(none)"}`)
    if (sr) {
      logger.info(`shiprocket metadata: ${JSON.stringify(sr, null, 2)}`)
    } else {
      logger.warn("shiprocket metadata: MISSING — subscriber never succeeded")
    }
  }
}
