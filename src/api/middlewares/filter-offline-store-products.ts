import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { isProductOffline } from "../../utils/product-availability"

type StoreProductPayload = { metadata?: Record<string, unknown> | null }

export function filterOfflineStoreProducts(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const originalJson = res.json.bind(res)

  res.json = (body: Record<string, unknown>) => {
    if (Array.isArray(body?.products)) {
      const all = body.products as StoreProductPayload[]
      const products = all.filter((product) => !isProductOffline(product))
      const removed = all.length - products.length
      const count =
        typeof body.count === "number"
          ? Math.max(0, body.count - removed)
          : products.length

      return originalJson({
        ...body,
        products,
        count,
        ...(typeof body.estimate_count === "number"
          ? { estimate_count: Math.max(0, body.estimate_count - removed) }
          : {}),
      })
    }

    if (body?.product && isProductOffline(body.product as StoreProductPayload)) {
      res.status(404)
      return originalJson({ message: "Product not found" })
    }

    return originalJson(body)
  }

  next()
}
