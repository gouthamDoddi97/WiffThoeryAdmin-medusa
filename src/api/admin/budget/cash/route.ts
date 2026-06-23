import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ensureBudgetSetup, getBudgetService, toErrorResponse } from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as {
      bank_balance?: number
      cash_in_hand?: number
      snapshot_date?: string
      notes?: string
      recorded_by?: string
      currency_code?: string
    }

    if (body.bank_balance == null || !body.recorded_by) {
      res.status(400).json({ message: "bank_balance and recorded_by are required" })
      return
    }

    const [snapshot] = await service.createCashSnapshots([
      {
        bank_balance: Number(body.bank_balance),
        cash_in_hand: Number(body.cash_in_hand ?? 0),
        snapshot_date: body.snapshot_date ? new Date(body.snapshot_date) : new Date(),
        notes: body.notes ?? null,
        recorded_by: String(body.recorded_by),
        currency_code: String(body.currency_code ?? "inr"),
      },
    ])

    res.status(201).json({ snapshot })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
