import { Module } from "@medusajs/framework/utils"
import RetailStoreModuleService from "./service"

export const RETAIL_STORE_MODULE = "retailStore"

export default Module(RETAIL_STORE_MODULE, {
  service: RetailStoreModuleService,
})
