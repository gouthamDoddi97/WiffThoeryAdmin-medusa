import { defineWidgetConfig } from "@medusajs/admin-sdk"
import "../lib/ca-access"
import { useCaAccessGuard } from "../lib/ca-access"

/**
 * Ensures CA bootstrap runs on login and common landing pages.
 * Module import above registers fetch intercept at admin startup.
 */
const CaAdminBootstrapWidget = () => {
  useCaAccessGuard()
  return null
}

export const config = defineWidgetConfig({
  zone: [
    "login.before",
    "login.after",
    "order.list.before",
    "product.list.before",
    "customer.list.before",
    "profile.details.before",
  ],
})

export default CaAdminBootstrapWidget
