import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { COLLECTION_BACKGROUND_MODULE } from "../../../../../modules/collection-background"
import CollectionBackgroundModuleService from "../../../../../modules/collection-background/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: CollectionBackgroundModuleService =
    req.scope.resolve(COLLECTION_BACKGROUND_MODULE)

  const [background] = await service.listCollectionBackgrounds({ collection_id: id })
  res.json({ collection_background: background ?? null })
}
