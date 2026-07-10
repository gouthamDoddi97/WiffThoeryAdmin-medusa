import { Module } from "@medusajs/framework/utils"
import FragranceNotesModuleService from "./service"

export const FRAGRANCE_NOTES_MODULE = "fragranceNotes"

export default Module(FRAGRANCE_NOTES_MODULE, {
  service: FragranceNotesModuleService,
})
