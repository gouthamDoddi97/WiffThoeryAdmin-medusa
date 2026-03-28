import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { UGC_GALLERY_MODULE } from "../../../modules/ugc-gallery"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(UGC_GALLERY_MODULE) as any

  const photos = await service.listUgcGalleryPhotos(
    { is_active: true },
    { order: { sort_order: "ASC" }, take: 5 }
  )

  res.json({ ugc_gallery_photos: photos })
}
