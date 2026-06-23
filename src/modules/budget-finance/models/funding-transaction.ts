import { model } from "@medusajs/framework/utils"

const FundingTransaction = model.define("budget_funding_transaction", {
  id: model.id().primaryKey(),
  funding_source_id: model.text(),
  type: model.text(),
  amount: model.number(),
  transaction_date: model.dateTime(),
  notes: model.text().nullable(),
  recorded_by: model.text(),
})

export default FundingTransaction
