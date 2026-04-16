import { model } from "@medusajs/framework/utils"

/**
 * A curated fragrance set (e.g. "Unisex Duo").
 *
 * items        – JSON array of set contents:
 *   { product_id, variant_id, product_title, variant_title, thumbnail }[]
 *
 * price_amount – price in the smallest currency unit (e.g. paise for INR).
 * tags         – comma-separated or JSON string array for display tags.
 * usage_tips   – free-text markdown / plain text shown on the detail page.
 * ingredients  – free-text ingredient disclosure.
 * brand_info   – brand & manufacturer information.
 */
const FragranceSet = model.define("fragrance_set", {
  id: model.id().primaryKey(),
  title: model.text(),
  description: model.text().nullable(),
  price_amount: model.number(),
  currency_code: model.text().default("inr"),
  items: model.json(),
  is_active: model.boolean().default(true),
  badge: model.text().nullable(),
  tags: model.text().nullable(),
  usage_tips: model.text().nullable(),
  ingredients: model.text().nullable(),
  brand_info: model.text().nullable(),
})

export default FragranceSet
