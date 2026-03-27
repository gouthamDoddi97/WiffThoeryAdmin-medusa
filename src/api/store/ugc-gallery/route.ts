import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { UGC_GALLERY_MODULE } from "../../../modules/ugc-gallery"
import UgcGalleryModuleService from "../../../modules/ugc-gallery/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: UgcGalleryModuleService = req.scope.resolve(UGC_GALLERY_MODULE)

  const photos = await service.listUgcGalleryPhotos(
    { is_active: true },
    { order: { sort_order: "ASC" }, take: 5 }
  )

  res.json({ ugc_gallery_photos: photos })
}
