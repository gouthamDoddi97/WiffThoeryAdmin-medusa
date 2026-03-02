import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { PERFUME_DETAILS_MODULE } from "../../../../../modules/perfume-details"
import PerfumeDetailsModuleService from "../../../../../modules/perfume-details/service"

type PerfumeDetailsBody = {
  certifications?: string
  top_notes?: string
  middle_notes?: string
  base_notes?: string
  scent_story?: string
  usage_tips?: string
  ingredients?: string
  brand_info?: string
  manufacturer_info?: string
  license_no?: string
  expiry_info?: string
  customer_care?: string
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: PerfumeDetailsModuleService = req.scope.resolve(PERFUME_DETAILS_MODULE)

  const [details] = await service.listPerfumeDetails({ product_id: id })
  res.json({ perfume_details: details ?? null })
}

export async function POST(
  req: MedusaRequest<PerfumeDetailsBody>,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: PerfumeDetailsModuleService = req.scope.resolve(PERFUME_DETAILS_MODULE)

  const [existing] = await service.listPerfumeDetails({ product_id: id })

  let details
  if (existing) {
    details = await service.updatePerfumeDetails({
      id: existing.id,
      ...req.body,
    })
  } else {
    details = await service.createPerfumeDetails({
      product_id: id,
      ...req.body,
    })
  }

  res.json({ perfume_details: details })
}
