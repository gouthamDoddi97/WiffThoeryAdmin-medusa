import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  getBudgetService,
  syncFounderFundingLabels,
  toErrorResponse,
} from "../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as {
      founder_1_name?: string
      founder_2_name?: string
      founder_3_name?: string
      founder_1_email?: string | null
      founder_2_email?: string | null
      founder_3_email?: string | null
      default_currency?: string
    }

    const [existing] = await service.listBudgetSettings({}, { take: 1 })
    if (!existing) {
      res.status(404).json({ message: "Settings not found" })
      return
    }

    const settings = await service.updateBudgetSettings({
      id: existing.id,
      ...body,
    })

    await syncFounderFundingLabels(req)
    res.json({ settings })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
