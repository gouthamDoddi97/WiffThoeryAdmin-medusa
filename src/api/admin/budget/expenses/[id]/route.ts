import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, toErrorResponse } from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const { id } = req.params
    const body = req.body as Record<string, unknown>

    const expense = await service.updateExpenses({
      id,
      ...body,
      ...(body.expense_date ? { expense_date: new Date(String(body.expense_date)) } : {}),
      ...(body.amount != null ? { amount: Number(body.amount) } : {}),
    })

    res.json({ expense })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await service.deleteExpenses(req.params.id)
    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
