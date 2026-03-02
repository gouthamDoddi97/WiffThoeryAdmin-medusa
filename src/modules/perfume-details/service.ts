import { MedusaService } from "@medusajs/framework/utils"
import PerfumeDetails from "./models/perfume-details"

class PerfumeDetailsModuleService extends MedusaService({
  PerfumeDetails,
}) {}

export default PerfumeDetailsModuleService
