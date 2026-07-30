import { model } from "@medusajs/framework/utils"

const Expense = model.define("budget_expense", {
  id: model.id().primaryKey(),
  category_id: model.text(),
  amount: model.number(),
  currency_code: model.text().default("inr"),
  expense_date: model.dateTime(),
  vendor: model.text().nullable(),
  payment_method: model.text().default("upi"),
  description: model.text(),
  funding_source_id: model.text().nullable(),
  business_event_id: model.text().nullable(),
  plan_id: model.text().nullable(),
  plan_line_item_id: model.text().nullable(),
  recorded_by: model.text(),
  notes: model.text().nullable(),
  receipt_url: model.text().nullable(),
  /** GST portion included in `amount` — claimable input tax. */
  gst_amount: model.number().default(0),
})

export default Expense
