import { Module } from "@medusajs/framework/utils"
import OffersModuleService from "./service"

export const OFFERS_MODULE = "offers"

export default Module(OFFERS_MODULE, {
  service: OffersModuleService,
})
