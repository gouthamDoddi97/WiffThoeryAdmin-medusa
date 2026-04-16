import { MedusaService } from "@medusajs/framework/utils"
import FragranceSet from "./models/fragrance-set"

class OffersModuleService extends MedusaService({
  FragranceSet,
}) {}

export default OffersModuleService
