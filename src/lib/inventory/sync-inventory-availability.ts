import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type { IProductModuleService } from "@medusajs/framework/types"
import {
  availabilityMetadataPatch,
  isInventoryItemOffline,
  PRODUCT_AVAILABILITY_KEY,
  PRODUCT_AVAILABILITY_OFFLINE,
  type StorefrontAvailability,
} from "../../utils/product-availability"

type VariantInventoryLink = {
  id?: string
  metadata?: Record<string, unknown> | null
  inventory_items?: Array<{
    inventory_item_id?: string | null
    inventory?: { id?: string | null } | null
  }> | null
}

function inventoryLinkMatchesItem(
  link: {
    inventory_item_id?: string | null
    inventory?: { id?: string | null } | null
  },
  inventoryItemId: string
): boolean {
  return (
    link.inventory_item_id === inventoryItemId ||
    link.inventory?.id === inventoryItemId
  )
}

function inventoryItemIdsForVariant(variant: VariantInventoryLink): string[] {
  const ids = new Set<string>()
  for (const link of variant.inventory_items ?? []) {
    const id = link.inventory_item_id ?? link.inventory?.id
    if (id) ids.add(id)
  }
  return [...ids]
}

export async function listVariantIdsForInventoryItem(
  container: MedusaContainer,
  inventoryItemId: string
): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "inventory_items.inventory_item_id", "inventory_items.inventory.id"],
    pagination: { take: 5000, skip: 0 },
  })

  return (variants as VariantInventoryLink[])
    .filter((variant) =>
      variant.inventory_items?.some((link) =>
        inventoryLinkMatchesItem(link, inventoryItemId)
      )
    )
    .map((variant) => variant.id)
    .filter((id): id is string => Boolean(id))
}

/** Variant is storefront-offline if any linked inventory item is offline. */
export async function recomputeVariantStorefrontAvailability(
  container: MedusaContainer,
  variantId: string
): Promise<StorefrontAvailability> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryModule = container.resolve(Modules.INVENTORY) as {
    listInventoryItems: (
      filters: Record<string, unknown>,
      config?: { take?: number }
    ) => Promise<Array<{ id: string; metadata?: Record<string, unknown> | null }>>
  }
  const productModule = container.resolve<IProductModuleService>(Modules.PRODUCT)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "metadata",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.id",
    ],
    filters: { id: variantId },
  })

  const variant = variants?.[0] as VariantInventoryLink | undefined
  if (!variant?.id) {
    throw new Error("Variant not found")
  }

  const itemIds = inventoryItemIdsForVariant(variant)
  let availability: StorefrontAvailability = "online"

  if (itemIds.length) {
    const items = await inventoryModule.listInventoryItems(
      { id: itemIds },
      { take: itemIds.length }
    )
    if (items.some((item) => isInventoryItemOffline(item))) {
      availability = "offline"
    }
  }

  await productModule.updateProductVariants(variant.id, {
    metadata: availabilityMetadataPatch(availability, variant.metadata),
  })

  return availability
}

export async function setInventoryItemStorefrontAvailability(
  container: MedusaContainer,
  inventoryItemId: string,
  availability: StorefrontAvailability
): Promise<{ variant_ids: string[] }> {
  const inventoryModule = container.resolve(Modules.INVENTORY) as {
    listInventoryItems: (
      filters: Record<string, unknown>,
      config?: { take?: number }
    ) => Promise<Array<{ id: string; metadata?: Record<string, unknown> | null }>>
    updateInventoryItems: (input: {
      id: string
      metadata: Record<string, unknown>
    }) => Promise<unknown>
  }

  const [item] = await inventoryModule.listInventoryItems(
    { id: inventoryItemId },
    { take: 1 }
  )

  if (!item) {
    throw new Error("Inventory item not found")
  }

  await inventoryModule.updateInventoryItems({
    id: inventoryItemId,
    metadata: availabilityMetadataPatch(availability, item.metadata),
  })

  const variantIds = await listVariantIdsForInventoryItem(
    container,
    inventoryItemId
  )

  for (const variantId of variantIds) {
    await recomputeVariantStorefrontAvailability(container, variantId)
  }

  return { variant_ids: variantIds }
}

export async function getInventoryItemStorefrontAvailability(
  container: MedusaContainer,
  inventoryItemId: string
): Promise<StorefrontAvailability> {
  const inventoryModule = container.resolve(Modules.INVENTORY) as {
    listInventoryItems: (
      filters: Record<string, unknown>,
      config?: { take?: number }
    ) => Promise<Array<{ id: string; metadata?: Record<string, unknown> | null }>>
  }

  const [item] = await inventoryModule.listInventoryItems(
    { id: inventoryItemId },
    { take: 1 }
  )

  if (!item) {
    throw new Error("Inventory item not found")
  }

  return item.metadata?.[PRODUCT_AVAILABILITY_KEY] === PRODUCT_AVAILABILITY_OFFLINE
    ? "offline"
    : "online"
}
