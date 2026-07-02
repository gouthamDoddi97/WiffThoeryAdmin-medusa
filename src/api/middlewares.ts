import { defineMiddlewares } from "@medusajs/framework/http"
import {
  ensureProductMetadataField,
  filterOfflineStoreProducts,
} from "./middlewares/filter-offline-store-products"

const offlineProductMiddlewares = [
  ensureProductMetadataField,
  filterOfflineStoreProducts,
]

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/products*",
      middlewares: offlineProductMiddlewares,
    },
    {
      matcher: "/store/product-categories*",
      middlewares: offlineProductMiddlewares,
    },
    {
      matcher: "/store/collections*",
      middlewares: offlineProductMiddlewares,
    },
  ],
})
