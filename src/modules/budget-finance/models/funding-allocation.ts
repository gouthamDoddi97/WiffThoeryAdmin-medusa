import { model } from "@medusajs/framework/utils"

const FundingAllocation = model.define("budget_funding_allocation", {
  id: model.id().primaryKey(),
  funding_source_id: model.text(),
  category_id: model.text(),
  planned_amount: model.number(),
  notes: model.text().nullable(),
})

export default FundingAllocation
