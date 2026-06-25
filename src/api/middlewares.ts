import { defineMiddlewares } from "@medusajs/framework/http"
import { filterOfflineStoreProducts } from "./middlewares/filter-offline-store-products"

export default defineMiddlewares({
  routes: [
    {
      matcher: /^\/store\/products(\/.*)?$/,
      middlewares: [filterOfflineStoreProducts],
    },
  ],
})
