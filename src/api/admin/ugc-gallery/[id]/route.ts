import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { UGC_GALLERY_MODULE } from "../../../../modules/ugc-gallery"

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(UGC_GALLERY_MODULE) as any

  await service.deleteUgcGalleryPhotos(id)

  res.json({ deleted: true, id })
}
