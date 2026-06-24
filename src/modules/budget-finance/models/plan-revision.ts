import { model } from "@medusajs/framework/utils"

const PlanRevision = model.define("budget_plan_revision", {
  id: model.id().primaryKey(),
  plan_id: model.text(),
  revision_type: model.text(),
  item_label: model.text(),
  revised_item_label: model.text().nullable(),
  category_id: model.text().nullable(),
  original_quantity: model.number().nullable(),
  revised_quantity: model.number().nullable(),
  original_unit_price: model.number().nullable(),
  revised_unit_price: model.number().nullable(),
  original_total: model.number().default(0),
  revised_total: model.number().default(0),
  savings: model.number().default(0),
  reason: model.text().nullable(),
  actor: model.text(),
})

export default PlanRevision
