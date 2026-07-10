import { MedusaService } from "@medusajs/framework/utils"
import FragranceNote from "./models/fragrance-note"

class FragranceNotesModuleService extends MedusaService({
  FragranceNote,
}) {}

export default FragranceNotesModuleService
