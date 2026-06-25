import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  ensureBudgetSetup,
  getBudgetService,
  logTaskActivity,
  notifyFounderTask,
  toErrorResponse,
} from "../../../budget/shared"

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
      recurrence?: string
      recurrence_interval_days?: number | null
      recurrence_end_date?: string | null
    }

    if (!body.title?.trim() || !body.assigned_to?.trim() || !body.created_by?.trim()) {
      res.status(400).json({
        message: "title, assigned_to, and created_by are required",
      })
      return
    }

    const recurrence = body.recurrence ?? "none"
    if (recurrence === "custom" && !body.recurrence_interval_days) {
      res.status(400).json({
        message: "recurrence_interval_days is required for custom repeat",
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
        recurrence,
        recurrence_interval_days:
          recurrence === "custom" ? Number(body.recurrence_interval_days) : null,
        recurrence_end_date: body.recurrence_end_date
          ? new Date(body.recurrence_end_date)
          : null,
        plan_id: null,
        is_milestone: false,
      },
    ])

    await logTaskActivity(req, task.id, "created", body.created_by.trim(), {
      assigned_to: body.assigned_to,
      recurrence,
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
