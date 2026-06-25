import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  assertTaskAssignee,
  buildTaskChangeSummary,
  getBudgetService,
  logTaskActivity,
  logTaskFieldChanges,
  notifyFounderTask,
  spawnNextRecurringTask,
  toErrorResponse,
} from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const { id } = req.params
    const body = req.body as {
      title?: string
      description?: string | null
      due_date?: string | null
      status?: string
      priority?: string
      recurrence?: string
      recurrence_interval_days?: number | null
      recurrence_end_date?: string | null
      attachment_url?: string | null
      actor?: string
      comment?: string
    }

    const [existing] = await service.listFounderTasks({ id }, { take: 1 })
    if (!existing) {
      res.status(404).json({ message: "Task not found" })
      return
    }

    const actor = body.actor ?? existing.assigned_to
    assertTaskAssignee(actor, existing.assigned_to)

    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description
    if (body.due_date !== undefined) {
      updates.due_date = body.due_date ? new Date(body.due_date) : null
    }
    if (body.status !== undefined) updates.status = body.status
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.recurrence !== undefined) updates.recurrence = body.recurrence
    if (body.recurrence_interval_days !== undefined) {
      updates.recurrence_interval_days = body.recurrence_interval_days
    }
    if (body.recurrence_end_date !== undefined) {
      updates.recurrence_end_date = body.recurrence_end_date
        ? new Date(body.recurrence_end_date)
        : null
    }
    if (body.attachment_url !== undefined) {
      updates.attachment_url = body.attachment_url?.trim() || null
    }

    await logTaskFieldChanges(req, id, actor, existing as Record<string, unknown>, updates)

    if (body.comment?.trim()) {
      await logTaskActivity(req, id, "comment", actor, { text: body.comment.trim() })
    }

    const task = await service.updateFounderTasks({
      id,
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.due_date !== undefined
        ? { due_date: body.due_date ? new Date(body.due_date) : null }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.recurrence !== undefined ? { recurrence: body.recurrence } : {}),
      ...(body.recurrence_interval_days !== undefined
        ? { recurrence_interval_days: body.recurrence_interval_days }
        : {}),
      ...(body.recurrence_end_date !== undefined
        ? {
            recurrence_end_date: body.recurrence_end_date
              ? new Date(body.recurrence_end_date)
              : null,
          }
        : {}),
      ...(body.attachment_url !== undefined
        ? { attachment_url: body.attachment_url?.trim() || null }
        : {}),
    })

    const changes = buildTaskChangeSummary(existing, body)
    if (changes.length > 0 || body.comment?.trim()) {
      await notifyFounderTask(req, {
        task,
        event: "updated",
        actor,
        changes,
      })
    }

    if (body.status === "done" && existing.status !== "done") {
      await spawnNextRecurringTask(req, {
        title: task.title,
        description: task.description,
        assigned_to: task.assigned_to,
        created_by: existing.created_by,
        priority: task.priority,
        recurrence: task.recurrence ?? "none",
        recurrence_interval_days: task.recurrence_interval_days,
        recurrence_end_date: task.recurrence_end_date,
        due_date: task.due_date,
      })
    }

    res.json({ task })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as { actor?: string }
    const [existing] = await service.listFounderTasks({ id: req.params.id }, { take: 1 })

    if (!existing) {
      res.status(404).json({ message: "Task not found" })
      return
    }

    const actor = body?.actor ?? existing.assigned_to
    assertTaskAssignee(actor, existing.assigned_to)

    const activities = await service.listTaskActivities({ task_id: req.params.id }, { take: 200 })
    if (activities.length) {
      await service.deleteTaskActivities(activities.map((a: { id: string }) => a.id))
    }

    await service.deleteFounderTasks(req.params.id)
    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
