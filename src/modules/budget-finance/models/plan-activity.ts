import { model } from "@medusajs/framework/utils"

const PlanActivity = model.define("budget_plan_activity", {
  id: model.id().primaryKey(),
  plan_id: model.text(),
  action: model.text(),
  actor: model.text(),
  details: model.json().nullable(),
})

export default PlanActivity
