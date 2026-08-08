import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isShiprocketConfigured, isShiprocketLiveCheckoutEnabled } from "../../../../lib/integrations/config"
import {
  computeCartWeightKg,
  estimateCartWeightKg,
  listShiprocketCouriersForPincode,
} from "../../../../lib/shiprocket/cart-shipping"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pincode = String(req.query.pincode ?? "").trim()
  const cartId = String(req.query.cart_id ?? "").trim()

  if (!/^\d{6}$/.test(pincode)) {
    res.status(400).json({ error: "Provide a 6-digit pincode" })
    return
  }

  if (!isShiprocketConfigured() || !isShiprocketLiveCheckoutEnabled()) {
    res.json({ couriers: [], live: false })
    return
  }

  let weightKg = estimateCartWeightKg(1)
  if (cartId) {
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: carts } = await query.graph({
        entity: "cart",
        fields: [
          "id",
          "items.quantity",
          "items.metadata",
          "items.variant.weight",
          "items.product.weight",
        ],
        filters: { id: cartId },
      })
      const cart = carts?.[0] as
        | {
            items?: Array<{
              quantity?: number
              metadata?: Record<string, unknown> | null
              variant?: { weight?: number | null }
              product?: { weight?: number | null }
            }> | null
          }
        | undefined
      weightKg = computeCartWeightKg(cart?.items)
    } catch {
      // fall back to default weight
    }
  }

  try {
    const couriers = await listShiprocketCouriersForPincode(pincode, weightKg)
    const payload = {
      couriers,
      live: process.env.SHIPROCKET_DEMO_MODE !== "true",
      weight_kg: weightKg,
      pincode,
    }
    res.json(payload)
  } catch (e) {
    console.warn(`[shipping/couriers] Failed for ${pincode}`, e)
    res.status(502).json({
      error:
        e instanceof Error
          ? e.message
          : "Could not fetch Shiprocket delivery options",
      couriers: [],
    })
  }
}
