import { defineMiddlewares } from "@medusajs/framework/http"
import {
  ensureProductMetadataField,
  filterOfflineStoreProducts,
} from "./middlewares/filter-offline-store-products"
import { requireStockLocationAddress } from "./middlewares/validate-stock-location-address"
import { requirePackingLabelBeforeFulfillment } from "./middlewares/require-packing-label"

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
    {
      methods: ["POST"],
      matcher: "/admin/stock-locations",
      middlewares: [requireStockLocationAddress],
    },
    {
      methods: ["POST"],
      matcher: "/admin/stock-locations/:id",
      middlewares: [requireStockLocationAddress],
    },
    {
      methods: ["POST"],
      matcher: "/admin/orders/:id/fulfillments",
      middlewares: [requirePackingLabelBeforeFulfillment],
    },
  ],
})
