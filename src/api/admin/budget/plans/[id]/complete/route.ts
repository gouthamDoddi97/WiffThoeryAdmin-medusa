import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import {
  assertPlanInvoiceForCompletion,
  createExpensesFromCompletedPlan,
  getBudgetService,
  getPlanPlannedTotal,
  logPlanActivity,
  toErrorResponse,
} from "../../../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const { id } = req.params
    const body = req.body as { actor?: string; invoice_url?: string }

    const [plan] = await service.listPlans({ id }, { take: 1 })
    if (!plan) {
      res.status(404).json({ message: "Plan not found" })
      return
    }

    if (plan.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Only active plans can be completed"
      )
    }

    const plannedTotal = await getPlanPlannedTotal(req, id)
    const invoiceUrl = body.invoice_url?.trim() || plan.invoice_url
    assertPlanInvoiceForCompletion(plannedTotal, invoiceUrl)

    const actor = body.actor ?? plan.created_by
    const updated = await service.updatePlans({
      id,
      status: "completed",
      ...(body.invoice_url?.trim() ? { invoice_url: body.invoice_url.trim() } : {}),
    })

    const expenses = await createExpensesFromCompletedPlan(req, id, {
      actor,
      invoiceUrl: invoiceUrl,
    })

    await logPlanActivity(req, id, "status_completed", actor, {
      from: "active",
      invoice_url: invoiceUrl,
      expenses_created: expenses.length,
    })

    res.json({ plan: updated, expenses_created: expenses.length })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
