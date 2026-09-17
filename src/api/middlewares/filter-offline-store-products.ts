import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  filterProductForOnlineStorefront,
} from "../../utils/product-availability"

type StoreProductPayload = {
  metadata?: Record<string, unknown> | null
  variants?: Array<{ metadata?: Record<string, unknown> | null }> | null
}

function stripOffline<T extends StoreProductPayload>(products: T[]): T[] {
  const result: T[] = []
  for (const product of products) {
    const filtered = filterProductForOnlineStorefront(product)
    if (filtered) {
      result.push(filtered)
    }
  }
  return result
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
  if (!body.product || typeof body.product !== "object") {
    return null
  }

  const product = body.product as StoreProductPayload
  const filtered = filterProductForOnlineStorefront(product)

  if (!filtered) {
    return { __offline_product: true }
  }

  if (filtered !== product) {
    return { ...body, product: filtered }
  }

  return null
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
  if (singleProduct) {
    return singleProduct
  }

  return (
    filterProductsPayload(body) ??
    filterCategoriesPayload(body) ??
    filterCollectionsPayload(body) ??
    body
  )
}

function requestPath(req: MedusaRequest): string {
  const raw = req.originalUrl ?? req.url ?? ""
  return raw.split("?")[0] ?? ""
}

/** Ensure metadata is loaded so offline filtering can read wt_availability. */
export function ensureProductMetadataField(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const fields = req.query.fields
  if (typeof fields !== "string") {
    next()
    return
  }

  const path = requestPath(req)
  let nextFields = fields

  // Nested products on category/collection routes — not Product.variants on the category entity.
  if (
    path.startsWith("/store/product-categories") ||
    path.startsWith("/store/collections")
  ) {
    if (!nextFields.includes("products.metadata")) {
      nextFields = `${nextFields},+products.metadata`
    }
    if (!nextFields.includes("products.variants.metadata")) {
      nextFields = `${nextFields},+products.variants.metadata`
    }
  } else if (path.startsWith("/store/products")) {
    if (!nextFields.includes("metadata")) {
      nextFields = `${nextFields},+metadata`
    }
    if (!nextFields.includes("variants.metadata")) {
      nextFields = `${nextFields},+variants.metadata`
    }
  }

  req.query.fields = nextFields
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
