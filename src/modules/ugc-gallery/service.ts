import { MedusaService } from "@medusajs/framework/utils"
import UgcGalleryPhoto from "./models/ugc-gallery-photo"

class UgcGalleryModuleService extends MedusaService({
  UgcGalleryPhoto,
}) {}

export default UgcGalleryModuleService
