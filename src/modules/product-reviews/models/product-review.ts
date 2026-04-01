import { model } from "@medusajs/framework/utils"

const ProductReview = model.define("product_review", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  author_name: model.text(),
  author_email: model.text().nullable(),
  rating: model.number(),
  title: model.text().nullable(),
  body: model.text(),
  is_approved: model.boolean().default(false),
})

export default ProductReview
