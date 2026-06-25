export const PRODUCT_AVAILABILITY_KEY = "wt_availability"
export const PRODUCT_AVAILABILITY_OFFLINE = "offline"

export type ProductAvailability = "online" | "offline"

export function isProductOffline(product: {
  metadata?: Record<string, unknown> | null
}): boolean {
  return product.metadata?.[PRODUCT_AVAILABILITY_KEY] === PRODUCT_AVAILABILITY_OFFLINE
}

export function getProductAvailability(product: {
  metadata?: Record<string, unknown> | null
}): ProductAvailability {
  return isProductOffline(product) ? "offline" : "online"
}

export function availabilityMetadataPatch(
  availability: ProductAvailability,
  existingMetadata?: Record<string, unknown> | null
): Record<string, unknown> {
  const metadata = { ...(existingMetadata ?? {}) }
  if (availability === "offline") {
    metadata[PRODUCT_AVAILABILITY_KEY] = PRODUCT_AVAILABILITY_OFFLINE
  } else {
    delete metadata[PRODUCT_AVAILABILITY_KEY]
  }
  return metadata
}
