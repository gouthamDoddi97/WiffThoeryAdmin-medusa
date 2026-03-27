import { Module } from "@medusajs/framework/utils"
import CollectionTierModuleService from "./service"

export const COLLECTION_TIER_MODULE = "collectionTier"

export default Module(COLLECTION_TIER_MODULE, {
  service: CollectionTierModuleService,
})
