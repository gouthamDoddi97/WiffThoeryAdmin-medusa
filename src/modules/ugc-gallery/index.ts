import { Module } from "@medusajs/framework/utils"
import UgcGalleryModuleService from "./service"

export const UGC_GALLERY_MODULE = "ugcGallery"

export default Module(UGC_GALLERY_MODULE, {
  service: UgcGalleryModuleService,
})
