import { Module } from "@medusajs/framework/utils"
import PerfumeDetailsModuleService from "./service"

export const PERFUME_DETAILS_MODULE = "perfumeDetails"

export default Module(PERFUME_DETAILS_MODULE, {
  service: PerfumeDetailsModuleService,
})
