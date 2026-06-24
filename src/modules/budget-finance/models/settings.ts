import { model } from "@medusajs/framework/utils"

const BudgetSettings = model.define("budget_settings", {
  id: model.id().primaryKey(),
  founder_1_name: model.text().default("Founder 1"),
  founder_2_name: model.text().default("Founder 2"),
  founder_3_name: model.text().default("Founder 3"),
  founder_1_email: model.text().nullable(),
  founder_2_email: model.text().nullable(),
  founder_3_email: model.text().nullable(),
  default_currency: model.text().default("inr"),
})

export default BudgetSettings
