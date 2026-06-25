import { model } from "@medusajs/framework/utils"

const PlanLineItem = model.define("budget_plan_line_item", {
  id: model.id().primaryKey(),
  plan_id: model.text(),
  label: model.text(),
  category_id: model.text(),
  quantity: model.number().default(1),
  unit_price: model.number().default(0),
  shipping: model.number().default(0),
  tax: model.number().default(0),
  sort_order: model.number().default(0),
  notes: model.text().nullable(),
  product_id: model.text().nullable(),
  variant_id: model.text().nullable(),
  planned_fragrance_name: model.text().nullable(),
})

export default PlanLineItem
