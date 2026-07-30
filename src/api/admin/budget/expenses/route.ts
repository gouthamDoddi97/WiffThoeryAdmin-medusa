import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ensureBudgetSetup, getBudgetService, toErrorResponse } from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as Record<string, unknown>

    if (!body.description || !body.amount || !body.category_id || !body.recorded_by) {
      res.status(400).json({ message: "description, amount, category_id, and recorded_by are required" })
      return
    }

    const gstAmount = body.gst_amount != null ? Number(body.gst_amount) : 0
    if (!Number.isFinite(gstAmount) || gstAmount < 0) {
      res.status(400).json({ message: "gst_amount must be a non-negative number" })
      return
    }
    if (gstAmount > Number(body.amount)) {
      res.status(400).json({ message: "gst_amount cannot exceed the expense amount" })
      return
    }

    const [expense] = await service.createExpenses([
      {
        category_id: String(body.category_id),
        amount: Number(body.amount),
        currency_code: String(body.currency_code ?? "inr"),
        expense_date: body.expense_date ? new Date(String(body.expense_date)) : new Date(),
        vendor: body.vendor ? String(body.vendor) : null,
        payment_method: String(body.payment_method ?? "upi"),
        description: String(body.description),
        funding_source_id: body.funding_source_id ? String(body.funding_source_id) : null,
        business_event_id: body.business_event_id ? String(body.business_event_id) : null,
        plan_id: body.plan_id ? String(body.plan_id) : null,
        plan_line_item_id: body.plan_line_item_id ? String(body.plan_line_item_id) : null,
        recorded_by: String(body.recorded_by),
        notes: body.notes ? String(body.notes) : null,
        receipt_url: body.receipt_url ? String(body.receipt_url) : null,
        gst_amount: gstAmount,
      },
    ])

    res.status(201).json({ expense })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
