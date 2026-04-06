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
  sillage: model.text().nullable(),        // "low" | "medium" | "high"
  longevity: model.text().nullable(),      // "low" | "medium" | "high"
  occasions: model.text().nullable(),      // comma-separated e.g. "day,evening,office"
  scent_weight: model.number().nullable(), // 1–10, light → heavy
  caption: model.text().nullable(),         // e.g. "Sweet fruity with amber base"
  animation_preset: model.text().nullable(), // storefront scene motion preset (legacy)
  fg_preset: model.text().nullable(),        // how image 2 enters (FgPreset)
  bg2_preset: model.text().nullable(),       // how image 3 enters (Bg2Preset)
  scene_image_1: model.text().nullable(),    // URL for parallax background image
  scene_image_2: model.text().nullable(),    // URL for parallax foreground image
  scene_image_3: model.text().nullable(),    // URL for parallax final background image
})

export default PerfumeDetails
