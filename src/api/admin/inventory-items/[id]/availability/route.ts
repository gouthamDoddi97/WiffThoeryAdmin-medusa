import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import {
  getInventoryItemStorefrontAvailability,
  listVariantIdsForInventoryItem,
  setInventoryItemStorefrontAvailability,
} from "../../../../../lib/inventory/sync-inventory-availability"
import type { StorefrontAvailability } from "../../../../../utils/product-availability"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const availability = await getInventoryItemStorefrontAvailability(
      req.scope,
      req.params.id
    )
    const variant_ids = await listVariantIdsForInventoryItem(
      req.scope,
      req.params.id
    )
    res.json({ availability, variant_ids })
  } catch {
    res.status(404).json({ message: "Inventory item not found" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { availability } = req.body as { availability?: StorefrontAvailability }

  if (availability !== "online" && availability !== "offline") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'availability must be "online" or "offline"'
    )
  }

  try {
    const result = await setInventoryItemStorefrontAvailability(
      req.scope,
      req.params.id,
      availability
    )

    res.json({
      availability,
      variant_ids: result.variant_ids,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update availability"
    if (message.includes("not found")) {
      res.status(404).json({ message })
      return
    }
    res.status(500).json({ message })
  }
}
