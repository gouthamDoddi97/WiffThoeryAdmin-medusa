import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetDashboard, toErrorResponse } from "../../budget/shared"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const data = await getBudgetDashboard(req)
    res.json(data)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
