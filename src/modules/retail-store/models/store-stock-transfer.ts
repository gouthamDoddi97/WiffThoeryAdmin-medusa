import { model } from "@medusajs/framework/utils"

const StoreStockTransfer = model.define("store_stock_transfer", {
  id: model.id().primaryKey(),
  retail_store_id: model.text(),
  from_stock_location_id: model.text(),
  variant_id: model.text(),
  quantity: model.number(),
  notes: model.text().nullable(),
})

export default StoreStockTransfer
