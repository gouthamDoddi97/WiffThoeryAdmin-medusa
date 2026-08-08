import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Inspect order totals and shipping amounts.
 * Run: npx medusa exec ./src/scripts/inspect-order-totals.ts [display_id]
 */
export default async function inspectOrderTotals({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const displayIdArg = process.argv.find((a) => /^\d+$/.test(a))
  const displayId = displayIdArg ? Number(displayIdArg) : undefined

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "currency_code",
      "total",
      "subtotal",
      "item_total",
      "item_subtotal",
      "shipping_total",
      "shipping_subtotal",
      "tax_total",
      "metadata",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.amount",
      "shipping_methods.subtotal",
      "shipping_methods.is_tax_inclusive",
      "summary",
    ],
    pagination: { take: 20, order: { created_at: "DESC" } },
  })

  const filtered = displayId
    ? (orders ?? []).filter((o) => Number(o.display_id) === displayId)
    : (orders ?? []).slice(0, 5)

  for (const order of filtered) {
    const methods = order.shipping_methods as
      | Array<{ id?: string; name?: string; amount?: number; subtotal?: number }>
      | undefined

    logger.info(`── Order #${order.display_id} ──`)
    logger.info(`item_total: ${order.item_total}, item_subtotal: ${order.item_subtotal}`)
    logger.info(
      `shipping_total: ${order.shipping_total}, shipping_subtotal: ${order.shipping_subtotal}`
    )
    logger.info(`tax_total: ${order.tax_total}, total: ${order.total}`)
    logger.info(`summary: ${JSON.stringify(order.summary)}`)
    logger.info(`shipping_methods: ${JSON.stringify(methods)}`)
    logger.info(
      `metadata.shiprocket: ${JSON.stringify((order.metadata as Record<string, unknown>)?.shiprocket)}`
    )
  }
}
