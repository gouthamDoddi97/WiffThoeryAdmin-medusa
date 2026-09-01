import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useCaAccessGuard } from "../lib/ca-access"

/** Runs CA redirect + sidebar hiding on common Medusa admin entry pages. */
const CaAccessGuardWidget = () => {
  useCaAccessGuard()
  return null
}

export const config = defineWidgetConfig({
  zone: [
    "order.list.before",
    "product.list.before",
    "customer.list.before",
    "inventory_item.list.before",
    "promotion.list.before",
    "profile.details.before",
    "login.after",
  ],
})

export default CaAccessGuardWidget
