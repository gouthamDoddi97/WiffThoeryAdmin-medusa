import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { UGC_GALLERY_MODULE } from "../../../../modules/ugc-gallery"
import UgcGalleryModuleService from "../../../../modules/ugc-gallery/service"

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: UgcGalleryModuleService = req.scope.resolve(UGC_GALLERY_MODULE)

  await service.deleteUgcGalleryPhotoes(id)

  res.json({ deleted: true, id })
}
