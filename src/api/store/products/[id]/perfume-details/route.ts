import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { PERFUME_DETAILS_MODULE } from "../../../../../modules/perfume-details"
import PerfumeDetailsModuleService from "../../../../../modules/perfume-details/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: PerfumeDetailsModuleService = req.scope.resolve(PERFUME_DETAILS_MODULE)

  const [details] = await service.listPerfumeDetails({ product_id: id })
  res.json({ perfume_details: details ?? null })
}
