import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import orderShiprocketHandler from "../subscribers/order-shiprocket"

/**
 * Manually push an existing Medusa order to Shiprocket.
 *
 * Run:
 *   npx medusa exec ./src/scripts/resync-shiprocket-order.ts order_01KZDTPTY6WMRAZSR2E8F07ASP
 *   npx medusa exec ./src/scripts/resync-shiprocket-order.ts 16
 */
export default async function resyncShiprocketOrder({
  container,
  args,
}: ExecArgs) {
  const input = String(args?.[0] ?? "").trim()
  if (!input) {
    throw new Error(
      "Pass an order id or display id, e.g. npx medusa exec ./src/scripts/resync-shiprocket-order.ts 16"
    )
  }

  let orderId = input

  if (!input.startsWith("order_")) {
    const displayId = Number(input)
    if (!Number.isFinite(displayId)) {
      throw new Error(`Invalid display id: ${input}`)
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id"],
      filters: { display_id: String(displayId) },
    })

    const match = orders?.[0] as { id?: string } | undefined
    if (!match?.id) {
      throw new Error(`No order found with display_id ${input}`)
    }
    orderId = match.id
  }

  console.info(`[resync-shiprocket] Syncing ${orderId}…`)
  await orderShiprocketHandler({
    event: { name: "order.placed", data: { id: orderId } },
    container,
  } as Parameters<typeof orderShiprocketHandler>[0])
  console.info(
    `[resync-shiprocket] Done — check order metadata + Shiprocket panel for WT-*`
  )
}
