import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, toErrorResponse } from "../../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as {
      funding_source_id?: string
      type?: string
      amount?: number
      transaction_date?: string
      notes?: string
      recorded_by?: string
    }

    if (!body.funding_source_id || !body.type || body.amount == null || !body.recorded_by) {
      res.status(400).json({
        message: "funding_source_id, type, amount, and recorded_by are required",
      })
      return
    }

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount === 0) {
      res.status(400).json({ message: "amount must be a non-zero number" })
      return
    }

    const [transaction] = await service.createFundingTransactions([
      {
        funding_source_id: String(body.funding_source_id),
        type: String(body.type),
        amount,
        transaction_date: body.transaction_date
          ? new Date(body.transaction_date)
          : new Date(),
        notes: body.notes ?? null,
        recorded_by: String(body.recorded_by),
      },
    ])

    res.status(201).json({ transaction })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
