import { model } from "@medusajs/framework/utils"

const ProductCostSheet = model.define("budget_product_cost_sheet", {
  id: model.id().primaryKey(),
  name: model.text(),
  product_id: model.text().nullable(),
  variant_id: model.text().nullable(),
  line_type: model.text().default("core"),
  fragrance_cost: model.number().default(0),
  alcohol_cost: model.number().default(0),
  bottle_cost: model.number().default(0),
  cap_cost: model.number().default(0),
  label_cost: model.number().default(0),
  box_cost: model.number().default(0),
  filling_cost: model.number().default(0),
  packaging_other: model.number().default(0),
  batch_quantity: model.number().default(0),
  units_sold: model.number().default(0),
  retail_price: model.number().default(0),
  avg_discount_percent: model.number().default(0),
  notes: model.text().nullable(),
})

export default ProductCostSheet
