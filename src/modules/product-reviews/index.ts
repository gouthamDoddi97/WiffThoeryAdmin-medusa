import { Module } from "@medusajs/framework/utils"
import ProductReviewModuleService from "./service"

export const PRODUCT_REVIEWS_MODULE = "productReviews"

export default Module(PRODUCT_REVIEWS_MODULE, {
  service: ProductReviewModuleService,
})
