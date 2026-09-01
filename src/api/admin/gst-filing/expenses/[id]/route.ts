import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { loadGstExpenseDetail } from "../../../../../lib/gst-filing/build-input-tax"

/** GET /admin/gst-filing/expenses/:id — input GST expense with invoice */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id?.trim()
  if (!id) {
    res.status(400).json({ message: "Expense id is required" })
    return
  }

  try {
    const expense = await loadGstExpenseDetail(req.scope, id)
    if (!expense) {
      res.status(404).json({ message: "Expense not found or has no GST" })
      return
    }

    res.json({ expense })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load expense"
    res.status(500).json({ message })
  }
}
