import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { isProductOffline } from "../../utils/product-availability"

type StoreProductPayload = { metadata?: Record<string, unknown> | null }

function stripOffline<T extends StoreProductPayload>(products: T[]): T[] {
  return products.filter((product) => !isProductOffline(product))
}

function adjustCount(
  body: Record<string, unknown>,
  removed: number,
  nextCount: number
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    count:
      typeof body.count === "number"
        ? Math.max(0, body.count - removed)
        : nextCount,
  }

  if (typeof body.estimate_count === "number") {
    patch.estimate_count = Math.max(0, body.estimate_count - removed)
  }

  return patch
}

function filterProductsPayload(body: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(body.products)) {
    return null
  }

  const all = body.products as StoreProductPayload[]
  const products = stripOffline(all)
  const removed = all.length - products.length

  return {
    ...body,
    products,
    ...adjustCount(body, removed, products.length),
  }
}

function filterSingleProductPayload(body: Record<string, unknown>): Record<string, unknown> | null {
  if (!body.product || !isProductOffline(body.product as StoreProductPayload)) {
    return null
  }

  return { __offline_product: true }
}

function filterCategoriesPayload(body: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(body.product_categories)) {
    return null
  }

  let removed = 0
  const product_categories = (body.product_categories as Array<Record<string, unknown>>).map(
    (category) => {
      if (!Array.isArray(category.products)) {
        return category
      }

      const all = category.products as StoreProductPayload[]
      const products = stripOffline(all)
      removed += all.length - products.length

      return { ...category, products }
    }
  )

  if (removed === 0) {
    return null
  }

  return {
    ...body,
    product_categories,
    ...adjustCount(body, removed, product_categories.length),
  }
}

function filterCollectionsPayload(body: Record<string, unknown>): Record<string, unknown> | null {
  if (Array.isArray(body.collections)) {
    let removed = 0
    const collections = (body.collections as Array<Record<string, unknown>>).map(
      (collection) => {
        if (!Array.isArray(collection.products)) {
          return collection
        }

        const all = collection.products as StoreProductPayload[]
        const products = stripOffline(all)
        removed += all.length - products.length

        return { ...collection, products }
      }
    )

    if (removed === 0) {
      return null
    }

    return {
      ...body,
      collections,
      ...adjustCount(body, removed, collections.length),
    }
  }

  if (body.collection && typeof body.collection === "object") {
    const collection = body.collection as Record<string, unknown>
    if (!Array.isArray(collection.products)) {
      return null
    }

    const all = collection.products as StoreProductPayload[]
    const products = stripOffline(all)
    const removed = all.length - products.length

    if (removed === 0) {
      return null
    }

    return {
      ...body,
      collection: { ...collection, products },
    }
  }

  return null
}

function filterStoreResponseBody(body: Record<string, unknown>): Record<string, unknown> {
  const singleProduct = filterSingleProductPayload(body)
  if (singleProduct?.__offline_product) {
    return { message: "Product not found", __status: 404 }
  }

  return (
    filterProductsPayload(body) ??
    filterCategoriesPayload(body) ??
    filterCollectionsPayload(body) ??
    body
  )
}

/** Ensure metadata is loaded so offline filtering can read wt_availability. */
export function ensureProductMetadataField(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const fields = req.query.fields
  if (typeof fields === "string" && !fields.includes("metadata")) {
    req.query.fields = `${fields},+metadata`
  }
  next()
}

export function filterOfflineStoreProducts(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const originalJson = res.json.bind(res)

  res.json = (body: Record<string, unknown>) => {
    const filtered = filterStoreResponseBody(body)

    if (filtered.__status === 404) {
      res.status(404)
      return originalJson({ message: filtered.message })
    }

    return originalJson(filtered)
  }

  next()
}
