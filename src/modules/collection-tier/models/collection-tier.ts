import { model } from "@medusajs/framework/utils"

const CollectionTierDetails = model.define("collection_tier_details", {
  id: model.id().primaryKey(),
  category_id: model.text().unique(),
  category_handle: model.text().nullable(),  // mirrors the category handle for easy storefront lookup
  tier_number: model.text().nullable(),       // e.g. "TIER 01 / 03"
  tagline: model.text().nullable(),           // e.g. "Your entry point. Instantly loved."
  description: model.text().nullable(),       // longer paragraph description
  accent_color: model.text().nullable(),      // e.g. "#4FDBCC"
  next_tier_label: model.text().nullable(),   // e.g. "Ready for More?"
  next_tier_href: model.text().nullable(),    // e.g. "/collections/intro-to-niche"
  next_tier_cta: model.text().nullable(),     // e.g. "EXPLORE INTRO TO NICHE"
  image_url: model.text().nullable(),         // background category image
})

export default CollectionTierDetails
