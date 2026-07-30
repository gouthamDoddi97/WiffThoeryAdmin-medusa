import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { isShiprocketConfigured } from "../../../../lib/integrations/config"
import { checkShiprocketServiceability } from "../../../../lib/shiprocket/client"

type PincodeCheckPayload = {
  /** null = check unavailable (Shiprocket not configured / API error) — don't block checkout */
  serviceable: boolean | null
  courier_count?: number
  min_days?: number | null
  max_days?: number | null
}

type CacheEntry = { expiresAt: number; payload: PincodeCheckPayload }

const CACHE_TTL_MS = 10 * 60 * 1000
const cache = new Map<string, CacheEntry>()

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pincode = String(req.query.pincode ?? "").trim()

  if (!/^\d{6}$/.test(pincode)) {
    res.status(400).json({ error: "Provide a 6-digit pincode" })
    return
  }

  if (!isShiprocketConfigured()) {
    res.json({ serviceable: null } satisfies PincodeCheckPayload)
    return
  }

  const cached = cache.get(pincode)
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.payload)
    return
  }

  try {
    const couriers = await checkShiprocketServiceability(pincode)
    const days = couriers
      .map((c) => c.estimated_delivery_days)
      .filter((n): n is number => Number.isFinite(n))

    const payload: PincodeCheckPayload = {
      serviceable: couriers.length > 0,
      courier_count: couriers.length,
      min_days: days.length ? Math.min(...days) : null,
      max_days: days.length ? Math.max(...days) : null,
    }

    cache.set(pincode, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
    res.json(payload)
  } catch (e) {
    console.warn(`[pincode-check] Serviceability lookup failed for ${pincode}`, e)
    res.json({ serviceable: null } satisfies PincodeCheckPayload)
  }
}
