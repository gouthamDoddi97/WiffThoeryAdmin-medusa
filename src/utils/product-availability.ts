export const PRODUCT_AVAILABILITY_KEY = "wt_availability"
export const PRODUCT_AVAILABILITY_OFFLINE = "offline"

export type ProductAvailability = "online" | "offline"
export type StorefrontAvailability = ProductAvailability

export function isProductOffline(product: {
  metadata?: Record<string, unknown> | null
}): boolean {
  return product.metadata?.[PRODUCT_AVAILABILITY_KEY] === PRODUCT_AVAILABILITY_OFFLINE
}

export function isVariantOffline(variant: {
  metadata?: Record<string, unknown> | null
}): boolean {
  return variant.metadata?.[PRODUCT_AVAILABILITY_KEY] === PRODUCT_AVAILABILITY_OFFLINE
}

export function getProductAvailability(entity: {
  metadata?: Record<string, unknown> | null
}): StorefrontAvailability {
  return isProductOffline(entity) ? "offline" : "online"
}

export function getVariantAvailability(entity: {
  metadata?: Record<string, unknown> | null
}): StorefrontAvailability {
  return isVariantOffline(entity) ? "offline" : "online"
}

export function availabilityMetadataPatch(
  availability: StorefrontAvailability,
  existingMetadata?: Record<string, unknown> | null
): Record<string, unknown> {
  if (availability === "offline") {
    return {
      ...(existingMetadata ?? {}),
      [PRODUCT_AVAILABILITY_KEY]: PRODUCT_AVAILABILITY_OFFLINE,
    }
  }
  // Medusa mergeMetadata removes keys only when the merged value is "".
  return { [PRODUCT_AVAILABILITY_KEY]: "" }
}

type StoreProductShape = {
  metadata?: Record<string, unknown> | null
  variants?: Array<{ metadata?: Record<string, unknown> | null }> | null
}

/** Drop offline variants; return null if the product should be hidden on the storefront. */
export function filterProductForOnlineStorefront<T extends StoreProductShape>(
  product: T
): T | null {
  if (isProductOffline(product)) {
    return null
  }

  const rawVariants = product.variants
  // Store list/search payloads often omit variants — do not hide the whole product.
  if (!rawVariants?.length) {
    return product
  }

  const variants = rawVariants.filter((variant) => !isVariantOffline(variant))

  if (!variants.length) {
    return null
  }

  if (variants.length === rawVariants.length) {
    return product
  }

  return { ...product, variants } as T
}

export function isInventoryItemOffline(item: {
  metadata?: Record<string, unknown> | null
}): boolean {
  return item.metadata?.[PRODUCT_AVAILABILITY_KEY] === PRODUCT_AVAILABILITY_OFFLINE
}
