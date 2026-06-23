import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ensureBudgetSetup, getBudgetService, toErrorResponse } from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as {
      category_id?: string
      year?: number
      month?: number
      amount?: number
      currency_code?: string
    }

    if (!body.category_id || !body.year || !body.month || body.amount == null) {
      res.status(400).json({ message: "category_id, year, month, and amount are required" })
      return
    }

    const [budget] = await service.createMonthlyBudgets([
      {
        category_id: String(body.category_id),
        year: Number(body.year),
        month: Number(body.month),
        amount: Number(body.amount),
        currency_code: String(body.currency_code ?? "inr"),
      },
    ])

    res.status(201).json({ budget })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
