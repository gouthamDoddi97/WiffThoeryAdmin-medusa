import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { IProductModuleService } from "@medusajs/framework/types"
import {
  availabilityMetadataPatch,
  getProductAvailability,
  type ProductAvailability,
} from "../../../../../utils/product-availability"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const productModule = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const [product] = await productModule.listProducts({ id: req.params.id }, { take: 1 })

  if (!product) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  res.json({ availability: getProductAvailability(product) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { availability } = req.body as { availability?: ProductAvailability }
  if (availability !== "online" && availability !== "offline") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'availability must be "online" or "offline"'
    )
  }

  const productModule = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const [product] = await productModule.listProducts({ id: req.params.id }, { take: 1 })

  if (!product) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  const updated = await productModule.updateProducts(req.params.id, {
    metadata: availabilityMetadataPatch(availability, product.metadata),
  })

  res.json({ availability: getProductAvailability(updated) })
}
