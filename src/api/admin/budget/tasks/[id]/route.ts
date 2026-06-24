import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  buildTaskChangeSummary,
  getBudgetService,
  logTaskActivity,
  notifyFounderTask,
  toErrorResponse,
} from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const { id } = req.params
    const body = req.body as {
      title?: string
      description?: string | null
      assigned_to?: string
      due_date?: string | null
      status?: string
      priority?: string
      plan_id?: string | null
      is_milestone?: boolean
      attachment_url?: string | null
      actor?: string
      comment?: string
    }

    const [existing] = await service.listFounderTasks({ id }, { take: 1 })
    if (!existing) {
      res.status(404).json({ message: "Task not found" })
      return
    }

    const actor = body.actor ?? existing.created_by

    if (body.assigned_to && body.assigned_to !== existing.assigned_to) {
      await logTaskActivity(req, id, "reassigned", actor, {
        from: existing.assigned_to,
        to: body.assigned_to,
      })
    }

    if (body.status && body.status !== existing.status) {
      await logTaskActivity(req, id, "status_changed", actor, {
        from: existing.status,
        to: body.status,
      })
    }

    if (body.due_date !== undefined) {
      const oldDue = existing.due_date ? new Date(existing.due_date).toISOString() : null
      const newDue = body.due_date ? new Date(body.due_date).toISOString() : null
      if (oldDue !== newDue) {
        await logTaskActivity(req, id, "due_date_changed", actor, {
          from: oldDue,
          to: newDue,
        })
      }
    }

    if (body.comment?.trim()) {
      await logTaskActivity(req, id, "comment", actor, { text: body.comment.trim() })
    }

    const changes = buildTaskChangeSummary(existing, body)
    const reassigned =
      body.assigned_to != null &&
      body.assigned_to.trim() !== existing.assigned_to

    const task = await service.updateFounderTasks({
      id,
      ...(body.title ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.assigned_to ? { assigned_to: body.assigned_to.trim() } : {}),
      ...(body.due_date !== undefined
        ? { due_date: body.due_date ? new Date(body.due_date) : null }
        : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.priority ? { priority: body.priority } : {}),
      ...(body.plan_id !== undefined ? { plan_id: body.plan_id } : {}),
      ...(body.is_milestone !== undefined ? { is_milestone: body.is_milestone } : {}),
      ...(body.attachment_url !== undefined
        ? { attachment_url: body.attachment_url?.trim() || null }
        : {}),
    })

    if (
      body.attachment_url?.trim() &&
      body.attachment_url.trim() !== (existing.attachment_url ?? "")
    ) {
      await logTaskActivity(req, id, "attachment_added", actor, {
        attachment_url: body.attachment_url.trim(),
      })
    }

    if (changes.length > 0 || body.comment?.trim()) {
      await notifyFounderTask(req, {
        task,
        event: "updated",
        actor,
        changes,
        force: reassigned,
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

    if (existing) {
      await logTaskActivity(
        req,
        req.params.id,
        "cancelled",
        body?.actor ?? existing.created_by,
        {}
      )
      await service.updateFounderTasks({ id: req.params.id, status: "cancelled" })
    }

    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
