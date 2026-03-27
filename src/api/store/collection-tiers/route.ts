import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { COLLECTION_TIER_MODULE } from "../../../modules/collection-tier"
import CollectionTierModuleService from "../../../modules/collection-tier/service"

/**
 * GET /store/collection-tiers
 * Returns all collection tier details — keyed by category_handle for easy storefront lookup.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: CollectionTierModuleService = req.scope.resolve(COLLECTION_TIER_MODULE)

  const tiers = await service.listCollectionTierDetails({})
  res.json({ collection_tiers: tiers })
}
