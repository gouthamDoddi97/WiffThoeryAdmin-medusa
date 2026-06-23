import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, toErrorResponse } from "../../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as {
      funding_source_id?: string
      category_id?: string
      planned_amount?: number
      notes?: string
    }

    if (!body.funding_source_id || !body.category_id || body.planned_amount == null) {
      res.status(400).json({
        message: "funding_source_id, category_id, and planned_amount are required",
      })
      return
    }

    const [allocation] = await service.createFundingAllocations([
      {
        funding_source_id: String(body.funding_source_id),
        category_id: String(body.category_id),
        planned_amount: Number(body.planned_amount),
        notes: body.notes ?? null,
      },
    ])

    res.status(201).json({ allocation })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
