import { model } from "@medusajs/framework/utils"

const RetailStore = model.define("retail_store", {
  id: model.id().primaryKey(),
  name: model.text(),
  location: model.text(),
  stock_location_id: model.text(),
  is_active: model.boolean().default(true),
  notes: model.text().nullable(),
})

export default RetailStore
