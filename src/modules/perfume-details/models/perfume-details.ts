import { model } from "@medusajs/framework/utils"

const PerfumeDetails = model.define("perfume_details", {
  id: model.id().primaryKey(),
  product_id: model.text().unique(),
  certifications: model.text().nullable(),  // e.g. "Vegan | Cruelty Free | Clean"
  top_notes: model.text().nullable(),
  middle_notes: model.text().nullable(),
  base_notes: model.text().nullable(),
  scent_story: model.text().nullable(),
  usage_tips: model.text().nullable(),
  ingredients: model.text().nullable(),
  brand_info: model.text().nullable(),
  manufacturer_info: model.text().nullable(),
  license_no: model.text().nullable(),
  expiry_info: model.text().nullable(),
  customer_care: model.text().nullable(),
})

export default PerfumeDetails
