import { model } from "@medusajs/framework/utils"

const FundingSource = model.define("budget_funding_source", {
  id: model.id().primaryKey(),
  type: model.text(),
  label: model.text(),
  founder_key: model.text().nullable(),
  principal_amount: model.number().nullable(),
  interest_rate: model.number().nullable(),
  tenure_months: model.number().nullable(),
  emi_amount: model.number().nullable(),
  disbursement_date: model.dateTime().nullable(),
  maturity_date: model.dateTime().nullable(),
  status: model.text().default("active"),
  notes: model.text().nullable(),
  use_of_funds_notes: model.text().nullable(),
})

export default FundingSource
