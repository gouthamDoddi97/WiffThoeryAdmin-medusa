import { model } from "@medusajs/framework/utils"

const CashSnapshot = model.define("budget_cash_snapshot", {
  id: model.id().primaryKey(),
  snapshot_date: model.dateTime(),
  bank_balance: model.number(),
  cash_in_hand: model.number().default(0),
  currency_code: model.text().default("inr"),
  notes: model.text().nullable(),
  recorded_by: model.text(),
})

export default CashSnapshot
