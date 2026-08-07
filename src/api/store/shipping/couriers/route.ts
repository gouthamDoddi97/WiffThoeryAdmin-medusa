import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isShiprocketConfigured, isShiprocketLiveCheckoutEnabled } from "../../../../lib/integrations/config"
import {
  estimateCartWeightKg,
  listShiprocketCouriersForPincode,
} from "../../../../lib/shiprocket/cart-shipping"

type CacheEntry = { expiresAt: number; payload: unknown }
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()

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

  let itemCount = 1
  if (cartId) {
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: carts } = await query.graph({
        entity: "cart",
        fields: ["id", "*items"],
        filters: { id: cartId },
      })
      const cart = carts?.[0] as { items?: Array<{ quantity?: number }> } | undefined
      itemCount =
        cart?.items?.reduce((sum, line) => sum + (line.quantity ?? 1), 0) ?? 1
    } catch {
      // fall back to default weight
    }
  }

  const weightKg = estimateCartWeightKg(itemCount)
  const cacheKey = `${pincode}:${weightKg.toFixed(2)}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.payload)
    return
  }

  try {
    const couriers = await listShiprocketCouriersForPincode(pincode, weightKg)
    const payload = {
      couriers,
      live: process.env.SHIPROCKET_DEMO_MODE !== "true",
      weight_kg: weightKg,
      pincode,
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
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
