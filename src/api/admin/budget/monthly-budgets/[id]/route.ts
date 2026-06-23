import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, toErrorResponse } from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as { amount?: number }
    const budget = await service.updateMonthlyBudgets({
      id: req.params.id,
      ...(body.amount != null ? { amount: Number(body.amount) } : {}),
    })
    res.json({ budget })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await service.deleteMonthlyBudgets(req.params.id)
    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
