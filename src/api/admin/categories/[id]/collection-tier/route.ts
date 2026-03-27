import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { COLLECTION_TIER_MODULE } from "../../../../../modules/collection-tier"
import CollectionTierModuleService from "../../../../../modules/collection-tier/service"

type CollectionTierBody = {
  category_handle?: string
  tier_number?: string
  tagline?: string
  description?: string
  accent_color?: string
  next_tier_label?: string
  next_tier_href?: string
  next_tier_cta?: string
  image_url?: string
  imageUrl?: string
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: CollectionTierModuleService = req.scope.resolve(COLLECTION_TIER_MODULE)

  const [tier] = await service.listCollectionTierDetails({ category_id: id })
  res.json({ collection_tier: tier ?? null })
}

export async function POST(
  req: MedusaRequest<CollectionTierBody>,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: CollectionTierModuleService = req.scope.resolve(COLLECTION_TIER_MODULE)

  const [existing] = await service.listCollectionTierDetails({ category_id: id })

  const payload = {
    ...req.body,
    image_url: req.body.image_url ?? req.body.imageUrl,
  }

  let tier
  if (existing) {
    tier = await service.updateCollectionTierDetails({
      id: existing.id,
      ...payload,
    })
  } else {
    tier = await service.createCollectionTierDetails({
      category_id: id,
      ...payload,
    })
  }

  res.json({ collection_tier: tier })
}
