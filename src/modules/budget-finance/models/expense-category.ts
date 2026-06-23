import { model } from "@medusajs/framework/utils"

const ExpenseCategory = model.define("budget_expense_category", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text(),
  description: model.text().nullable(),
  sort_order: model.number().default(0),
  is_active: model.boolean().default(true),
})

export default ExpenseCategory
