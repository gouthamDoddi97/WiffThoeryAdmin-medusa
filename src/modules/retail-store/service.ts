import { MedusaService } from "@medusajs/framework/utils"
import RetailStore from "./models/retail-store"
import StoreStockTransfer from "./models/store-stock-transfer"

class RetailStoreModuleService extends MedusaService({
  RetailStore,
  StoreStockTransfer,
}) {}

export default RetailStoreModuleService
