import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import { getBudgetService, logPlanActivity, toErrorResponse } from "../../../../../budget/shared"

async function transitionPlan(
  req: MedusaRequest,
  res: MedusaResponse,
  newStatus: string,
  allowedFrom: string[]
) {
  const service = getBudgetService(req)
  const { id } = req.params
  const body = req.body as { actor?: string }

  const [plan] = await service.listPlans({ id }, { take: 1 })
  if (!plan) {
    res.status(404).json({ message: "Plan not found" })
    return
  }

  if (!allowedFrom.includes(plan.status)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Cannot move plan from ${plan.status} to ${newStatus}`
    )
  }

  const actor = body.actor ?? plan.created_by
  const updated = await service.updatePlans({ id, status: newStatus })
  await logPlanActivity(req, id, `status_${newStatus}`, actor, {
    from: plan.status,
    to: newStatus,
  })

  res.json({ plan: updated })
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    await transitionPlan(req, res, "active", ["draft"])
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
