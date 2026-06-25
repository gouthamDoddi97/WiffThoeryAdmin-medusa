import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  ensureBudgetSetup,
  getBudgetService,
  logPlanActivity,
  PlanLineItemInput,
  recordPlanRevisionsOnUpdate,
  replacePlanLineItems,
  toErrorResponse,
  validatePlanLineItems,
} from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as {
      title?: string
      created_by?: string
      deadline?: string
      notes?: string
      deferred_notes?: string
      funding_source_id?: string
      line_items?: PlanLineItemInput[]
    }

    if (!body.title?.trim() || !body.created_by?.trim()) {
      res.status(400).json({ message: "title and created_by are required" })
      return
    }

    await validatePlanLineItems(req, body.line_items)

    const [plan] = await service.createPlans([
      {
        title: body.title.trim(),
        status: "draft",
        created_by: body.created_by.trim(),
        deadline: body.deadline ? new Date(body.deadline) : null,
        notes: body.notes ?? null,
        deferred_notes: body.deferred_notes ?? null,
        funding_source_id: body.funding_source_id ?? null,
      },
    ])

    const lineItems = await replacePlanLineItems(req, plan.id, body.line_items ?? [])
    await recordPlanRevisionsOnUpdate(req, plan.id, {
      actor: body.created_by.trim(),
      oldLineItems: [],
      newLineItems: body.line_items,
    })
    await logPlanActivity(req, plan.id, "created", body.created_by.trim(), {
      title: plan.title,
      line_item_count: lineItems.length,
    })

    res.status(201).json({ plan, line_items: lineItems })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
