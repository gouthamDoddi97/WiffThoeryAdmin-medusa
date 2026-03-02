import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { COLLECTION_BACKGROUND_MODULE } from "../../../modules/collection-background"
import CollectionBackgroundModuleService from "../../../modules/collection-background/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: CollectionBackgroundModuleService =
    req.scope.resolve(COLLECTION_BACKGROUND_MODULE)

  const backgrounds = await service.listCollectionBackgrounds({})
  res.json({ collection_backgrounds: backgrounds })
}
