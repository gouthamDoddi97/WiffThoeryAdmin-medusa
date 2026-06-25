import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import {
  getBudgetService,
  logPlanActivity,
  PlanLineItemInput,
  recordPlanRevisionsOnUpdate,
  replacePlanLineItems,
  resyncExpensesForCompletedPlan,
  syncCompletedPlanExpensesIfStale,
  toErrorResponse,
  validatePlanLineItems,
} from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const { id } = req.params
    const body = req.body as {
      title?: string
      deadline?: string | null
      notes?: string | null
      deferred_notes?: string | null
      funding_source_id?: string | null
      invoice_url?: string | null
      line_items?: PlanLineItemInput[]
      actor?: string
    }
    const [existing] = await service.listPlans({ id }, { take: 1 })
    if (!existing) {
      res.status(404).json({ message: "Plan not found" })
      return
    }

    if (existing.status === "cancelled") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cancelled plans cannot be edited"
      )
    }

    const actor = body.actor ?? existing.created_by
    const plan = await service.updatePlans({
      id,
      ...(body.title ? { title: body.title.trim() } : {}),
      ...(body.deadline !== undefined
        ? { deadline: body.deadline ? new Date(body.deadline) : null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.deferred_notes !== undefined ? { deferred_notes: body.deferred_notes } : {}),
      ...(body.funding_source_id !== undefined
        ? { funding_source_id: body.funding_source_id }
        : {}),
      ...(body.invoice_url !== undefined
        ? { invoice_url: body.invoice_url?.trim() || null }
        : {}),
    })

    if (body.invoice_url?.trim()) {
      await logPlanActivity(req, id, "invoice_attached", actor, {
        invoice_url: body.invoice_url.trim(),
      })
    }

    let lineItems
    if (body.line_items) {
      await validatePlanLineItems(req, body.line_items)
      const oldLineItems = await service.listPlanLineItems({ plan_id: id }, { take: 200 })
      await recordPlanRevisionsOnUpdate(req, id, {
        actor,
        reason: body.deferred_notes?.trim() || body.notes?.trim() || null,
        oldLineItems,
        newLineItems: body.line_items,
      })
      lineItems = await replacePlanLineItems(req, id, body.line_items)
      if (existing.status === "completed") {
        await resyncExpensesForCompletedPlan(req, id, actor)
      }
      await logPlanActivity(req, id, "line_items_updated", actor, {
        count: lineItems.length,
        was_completed: existing.status === "completed",
      })
    }

    res.json({ plan, line_items: lineItems })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const { id } = req.params
    const [existing] = await service.listPlans({ id }, { take: 1 })

    if (!existing) {
      res.status(404).json({ message: "Plan not found" })
      return
    }

    if (existing.status !== "draft") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Only draft plans can be discarded"
      )
    }

    const lineItems = await service.listPlanLineItems({ plan_id: id }, { take: 200 })
    if (lineItems.length) {
      await service.deletePlanLineItems(lineItems.map((i: { id: string }) => i.id))
    }

    await service.deletePlans(id)
    res.json({ deleted: true, id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
