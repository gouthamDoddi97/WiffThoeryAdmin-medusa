import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, toErrorResponse } from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as Record<string, unknown>
    const numericFields = [
      "fragrance_cost",
      "alcohol_cost",
      "bottle_cost",
      "cap_cost",
      "label_cost",
      "box_cost",
      "filling_cost",
      "packaging_other",
      "batch_quantity",
      "units_sold",
      "retail_price",
      "avg_discount_percent",
    ]

    const update: Record<string, unknown> = { id: req.params.id, ...body }
    for (const field of numericFields) {
      if (body[field] != null) {
        update[field] = Number(body[field])
      }
    }

    const cost_sheet = await service.updateProductCostSheets(update)
    res.json({ cost_sheet })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await service.deleteProductCostSheets(req.params.id)
    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
