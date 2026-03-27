import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { UGC_GALLERY_MODULE } from "../../../modules/ugc-gallery"
import UgcGalleryModuleService from "../../../modules/ugc-gallery/service"

type UgcGalleryBody = {
  id?: string
  image_url: string
  alt_text?: string
  sort_order: number
  is_active?: boolean
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: UgcGalleryModuleService = req.scope.resolve(UGC_GALLERY_MODULE)

  const photos = await service.listUgcGalleryPhotos(
    {},
    { order: { sort_order: "ASC" }, take: 20 }
  )

  console.log("Returning UGC gallery photos:", photos)

  res.json({ ugc_gallery_photos: photos })
}

export async function POST(
  req: MedusaRequest<UgcGalleryBody>,
  res: MedusaResponse
): Promise<void> {
  const service: UgcGalleryModuleService = req.scope.resolve(UGC_GALLERY_MODULE)

  const { id, image_url, alt_text, sort_order, is_active } = req.body

  let photo
  if (id) {
    photo = await service.updateUgcGalleryPhotos({
      id,
      image_url,
      alt_text,
      sort_order,
      is_active,
    })
  } else {
    photo = await service.createUgcGalleryPhotos({
      image_url,
      alt_text,
      sort_order,
      is_active: is_active ?? true,
    })
  }

  res.json({ ugc_gallery_photo: photo })
}
