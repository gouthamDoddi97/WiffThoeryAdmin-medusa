import { model } from "@medusajs/framework/utils"

const CollectionBackground = model.define("collection_background", {
  id: model.id().primaryKey(),
  collection_id: model.text().unique(),
  file_url: model.text(),
  mobile_image_url: model.text().nullable(),
  badge: model.text().nullable(),
  description: model.text().nullable(),
  font_color_palette: model.text().nullable(), // "light" | "dark"
})

export default CollectionBackground
