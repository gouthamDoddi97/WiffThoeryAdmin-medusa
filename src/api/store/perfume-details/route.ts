import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { PERFUME_DETAILS_MODULE } from "../../../modules/perfume-details"
import PerfumeDetailsModuleService from "../../../modules/perfume-details/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: PerfumeDetailsModuleService =
    req.scope.resolve(PERFUME_DETAILS_MODULE)

  const rawIds = String(req.query.product_ids ?? "")
  const productIds = rawIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)

  if (productIds.length > 0) {
    const perfume_details = await service.listPerfumeDetails(
      { product_id: { $in: productIds } },
      { take: productIds.length }
    )
    res.json({ perfume_details })
    return
  }

  const perfume_details = await service.listPerfumeDetails({}, { take: 500 })
  res.json({ perfume_details })
}
