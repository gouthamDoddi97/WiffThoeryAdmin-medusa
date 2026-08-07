import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Assigns every product to the shipping profile used by store shipping options
 * (or the default profile). Fixes cart.complete() errors:
 * "cart items require shipping profiles that are not satisfied by the current shipping methods"
 *
 * Run: npx medusa exec ./src/scripts/fix-product-shipping-profiles.ts
 */
export default async function fixProductShippingProfiles({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  const shippingOptions = await fulfillmentModule.listShippingOptions({})
  const profileIdsFromOptions = [
    ...new Set(
      shippingOptions
        .map((o) => o.shipping_profile_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  let targetProfileId = profileIdsFromOptions[0]

  if (!targetProfileId) {
    const profiles = await fulfillmentModule.listShippingProfiles({
      type: "default",
    })
    targetProfileId = profiles[0]?.id
  }

  if (!targetProfileId) {
    logger.error("No shipping profile found.")
    return
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "shipping_profile_id"],
  })

  type ProductRow = {
    id: string
    title?: string | null
    handle?: string | null
    shipping_profile_id?: string | null
  }

  const mismatched = (products as ProductRow[]).filter(
    (p) => p.shipping_profile_id !== targetProfileId
  )

  if (mismatched.length === 0) {
    logger.info(
      `All ${products.length} product(s) already use shipping profile ${targetProfileId}.`
    )
    return
  }

  logger.info(
    `Updating ${mismatched.length} product(s) to shipping profile ${targetProfileId}…`
  )

  for (const product of mismatched) {
    logger.info(
      `  ${product.title ?? product.handle ?? product.id}: ${product.shipping_profile_id ?? "none"} → ${targetProfileId}`
    )
  }

  await updateProductsWorkflow(container).run({
    input: {
      products: mismatched.map((p) => ({
        id: p.id,
        shipping_profile_id: targetProfileId,
      })),
    },
  })

  logger.info("Done. Retry checkout / place order.")
}
