import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { recomputeVariantStorefrontAvailability } from "../lib/inventory/sync-inventory-availability"

/** Recompute variant wt_availability from linked inventory items (one-time fix). */
export default async function resyncVariantStorefrontAvailability({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id"],
    pagination: { take: 5000, skip: 0 },
  })

  let count = 0
  for (const row of variants ?? []) {
    const id = (row as { id?: string }).id
    if (!id) continue
    await recomputeVariantStorefrontAvailability(container, id)
    count++
  }

  logger.info(`Recomputed storefront availability for ${count} variant(s).`)
}
