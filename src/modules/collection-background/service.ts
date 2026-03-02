import { MedusaService } from "@medusajs/framework/utils"
import CollectionBackground from "./models/collection-background"

class CollectionBackgroundModuleService extends MedusaService({
  CollectionBackground,
}) {}

export default CollectionBackgroundModuleService
