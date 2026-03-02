import { Module } from "@medusajs/framework/utils"
import CollectionBackgroundModuleService from "./service"

export const COLLECTION_BACKGROUND_MODULE = "collectionBackground"

export default Module(COLLECTION_BACKGROUND_MODULE, {
  service: CollectionBackgroundModuleService,
})
