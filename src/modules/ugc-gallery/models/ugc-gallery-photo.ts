import { model } from "@medusajs/framework/utils"

const UgcGalleryPhoto = model.define("ugc_gallery_photo", {
  id: model.id().primaryKey(),
  image_url: model.text(),
  alt_text: model.text().nullable(),
  sort_order: model.number().default(0),
  is_active: model.boolean().default(true),
})

export default UgcGalleryPhoto
