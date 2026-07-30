import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { isShiprocketConfigured } from "../../../../lib/integrations/config"
import {
  trackShiprocketAwb,
  type ShiprocketTracking,
} from "../../../../lib/shiprocket/client"

type CacheEntry = { expiresAt: number; tracking: ShiprocketTracking }

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const awb = String(req.params.awb ?? "").trim()

  if (!awb || awb.length > 40) {
    res.status(400).json({ error: "Invalid tracking number" })
    return
  }

  const isDemoAwb = /^DEMO/i.test(awb)
  if (!isShiprocketConfigured() && !isDemoAwb) {
    res.status(404).json({ error: "Tracking unavailable" })
    return
  }

  const cached = cache.get(awb)
  if (cached && Date.now() < cached.expiresAt) {
    res.json({ tracking: cached.tracking })
    return
  }

  try {
    const tracking = await trackShiprocketAwb(awb)
    if (!tracking) {
      res.status(404).json({
        error:
          "No tracking information yet — couriers can take a few hours to activate tracking.",
      })
      return
    }

    cache.set(awb, { expiresAt: Date.now() + CACHE_TTL_MS, tracking })
    res.json({ tracking })
  } catch (e) {
    console.warn(`[tracking] Lookup failed for AWB ${awb}`, e)
    res.status(502).json({ error: "Tracking lookup failed — try again shortly." })
  }
}
