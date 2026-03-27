import { MedusaService } from "@medusajs/framework/utils"
import CollectionTierDetails from "./models/collection-tier"

class CollectionTierModuleService extends MedusaService({
  CollectionTierDetails,
}) {}

export default CollectionTierModuleService
