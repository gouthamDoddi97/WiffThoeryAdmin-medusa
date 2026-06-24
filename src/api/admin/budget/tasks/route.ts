import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ensureBudgetSetup, getBudgetService, logTaskActivity, notifyFounderTask, toErrorResponse } from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as {
      title?: string
      description?: string
      assigned_to?: string
      created_by?: string
      due_date?: string
      priority?: string
      plan_id?: string
      is_milestone?: boolean
    }

    if (!body.title?.trim() || !body.assigned_to?.trim() || !body.created_by?.trim()) {
      res.status(400).json({
        message: "title, assigned_to, and created_by are required",
      })
      return
    }

    const [task] = await service.createFounderTasks([
      {
        title: body.title.trim(),
        description: body.description ?? null,
        assigned_to: body.assigned_to.trim(),
        created_by: body.created_by.trim(),
        due_date: body.due_date ? new Date(body.due_date) : null,
        status: "todo",
        priority: body.priority ?? "medium",
        plan_id: body.plan_id ?? null,
        is_milestone: Boolean(body.is_milestone),
      },
    ])

    await logTaskActivity(req, task.id, "created", body.created_by.trim(), {
      assigned_to: body.assigned_to,
      plan_id: body.plan_id ?? null,
    })

    await notifyFounderTask(req, {
      task,
      event: "created",
      actor: body.created_by.trim(),
    })

    res.status(201).json({ task })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
