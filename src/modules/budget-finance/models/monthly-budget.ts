import { model } from "@medusajs/framework/utils"

const MonthlyBudget = model.define("budget_monthly_budget", {
  id: model.id().primaryKey(),
  category_id: model.text(),
  year: model.number(),
  month: model.number(),
  amount: model.number(),
  currency_code: model.text().default("inr"),
})

export default MonthlyBudget
