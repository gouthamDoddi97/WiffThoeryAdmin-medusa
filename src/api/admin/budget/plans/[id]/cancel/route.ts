import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import { getBudgetService, logPlanActivity, toErrorResponse } from "../../../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const { id } = req.params
    const body = req.body as { actor?: string }

    const [plan] = await service.listPlans({ id }, { take: 1 })
    if (!plan) {
      res.status(404).json({ message: "Plan not found" })
      return
    }

    if (!["draft", "active"].includes(plan.status)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Plan cannot be cancelled")
    }

    const actor = body.actor ?? plan.created_by
    const updated = await service.updatePlans({ id, status: "cancelled" })
    await logPlanActivity(req, id, "status_cancelled", actor, { from: plan.status })

    res.json({ plan: updated })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
