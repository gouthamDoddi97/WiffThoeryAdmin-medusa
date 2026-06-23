import { model } from "@medusajs/framework/utils"

const Plan = model.define("budget_plan", {
  id: model.id().primaryKey(),
  title: model.text(),
  status: model.text().default("draft"),
  deadline: model.dateTime().nullable(),
  created_by: model.text(),
  notes: model.text().nullable(),
  funding_source_id: model.text().nullable(),
  invoice_url: model.text().nullable(),
})

export default Plan
