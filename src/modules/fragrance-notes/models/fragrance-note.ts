import { model } from "@medusajs/framework/utils"

const FragranceNote = model.define("fragrance_note", {
  id: model.id().primaryKey(),
  /** Normalized lookup key — lowercase trimmed */
  name: model.text().unique(),
  display_name: model.text(),
  image_url: model.text().nullable(),
  perenual_species_id: model.number().nullable(),
  plant_query: model.text().nullable(),
  /** perenual | manual */
  image_source: model.text().nullable(),
})

export default FragranceNote
