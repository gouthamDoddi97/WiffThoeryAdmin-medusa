import { Button, Heading, Input, Label, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { AttachmentField } from "./attachment-field"
import { BudgetDashboardData, FounderTask, formatDate, labelFor } from "./types"
import { uploadBudgetAttachment } from "./upload"

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? "Request failed")
  return data as T
}

function activityLabel(entry: { action: string; details?: Record<string, unknown> | null }) {
  const d = entry.details ?? {}
  switch (entry.action) {
    case "created":
      return `Created · assigned to ${d.assigned_to ?? "—"}`
    case "field_changed":
      return `${d.field}: ${d.from} → ${d.to}`
    case "status_changed":
      return `Status ${d.from} → ${d.to}`
    case "due_date_changed":
      return "Due date updated"
    case "comment":
      return `Comment: ${d.text ?? ""}`
    case "attachment_added":
      return "Attachment added"
    case "cancelled":
      return "Task cancelled"
    default:
      return entry.action
  }
}

function recurrenceSummary(
  task: FounderTask,
  options: BudgetDashboardData["task_recurrence"]
): string | null {
  const recurrence = task.recurrence ?? "none"
  if (recurrence === "none") return null
  let label = labelFor(options, recurrence)
  if (recurrence === "custom" && task.recurrence_interval_days) {
    label = `Every ${task.recurrence_interval_days} days`
  }
  if (task.recurrence_end_date) {
    label += ` · until ${formatDate(task.recurrence_end_date)}`
  }
  return label
}

function toDateInput(value?: string | null): string {
  if (!value) return ""
  return value.slice(0, 10)
}

function TaskCard({
  task,
  data,
  currentUser,
  onRefresh,
}: {
  task: FounderTask
  data: BudgetDashboardData
  currentUser: string
  onRefresh: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState("")
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description ?? "",
    due_date: toDateInput(task.due_date),
    priority: task.priority,
    recurrence: task.recurrence ?? "none",
    recurrence_interval_days: task.recurrence_interval_days?.toString() ?? "",
    recurrence_end_date: toDateInput(task.recurrence_end_date),
  })

  const isAssignee = currentUser.trim() === task.assigned_to.trim()
  const repeatLabel = recurrenceSummary(task, data.task_recurrence)

  useEffect(() => {
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      due_date: toDateInput(task.due_date),
      priority: task.priority,
      recurrence: task.recurrence ?? "none",
      recurrence_interval_days: task.recurrence_interval_days?.toString() ?? "",
      recurrence_end_date: toDateInput(task.recurrence_end_date),
    })
  }, [task])

  const update = async (patch: Record<string, unknown>) => {
    if (!currentUser) {
      toast.error("Select who you are (top right)")
      return
    }
    if (!isAssignee) {
      toast.error("Only the assignee can update this task")
      return
    }
    try {
      await api(`/admin/budget/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, actor: currentUser }),
      })
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    }
  }

  const saveEdits = async () => {
    if (!editForm.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (editForm.recurrence === "custom" && !editForm.recurrence_interval_days) {
      toast.error("Enter how many days between repeats")
      return
    }
    await update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      due_date: editForm.due_date || null,
      priority: editForm.priority,
      recurrence: editForm.recurrence,
      recurrence_interval_days:
        editForm.recurrence === "custom"
          ? Number(editForm.recurrence_interval_days)
          : null,
      recurrence_end_date: editForm.recurrence_end_date || null,
    })
    setEditing(false)
    toast.success("Task updated")
  }

  const deleteTask = async () => {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    try {
      await api(`/admin/budget/tasks/${task.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: currentUser }),
      })
      toast.success("Task deleted")
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    }
  }

  const handleAttachmentUpload = async (file: File) => {
    setUploadingAttachment(true)
    try {
      const url = await uploadBudgetAttachment(file)
      await update({ attachment_url: url })
      toast.success("Attachment added")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploadingAttachment(false)
    }
  }

  const markDone = async () => {
    if (!window.confirm(`Mark "${task.title}" as done?`)) return
    await update({ status: "done" })
  }

  return (
    <div
      className={`border rounded-xl p-4 bg-ui-bg-base ${task.is_overdue ? "border-red-400" : "border-ui-border-base"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{task.title}</p>
          <p className="text-xs text-ui-fg-subtle mt-1">
            {task.assigned_to} · {labelFor(data.task_statuses, task.status)} ·{" "}
            {labelFor(data.task_priorities, task.priority)}
            {task.due_date ? ` · Due ${formatDate(task.due_date)}` : ""}
            {repeatLabel ? ` · ${repeatLabel}` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAssignee && task.status === "todo" && (
            <Button size="small" variant="secondary" onClick={() => update({ status: "in_progress" })}>
              Start
            </Button>
          )}
          {isAssignee && task.status !== "done" && task.status !== "cancelled" && (
            <Button size="small" onClick={markDone}>
              Done
            </Button>
          )}
          <Button size="small" variant="secondary" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide" : "Details"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-3 border-t border-ui-border-base pt-4">
          {!isAssignee && (
            <p className="text-xs text-ui-fg-subtle">
              Only {task.assigned_to} can edit or delete this task.
            </p>
          )}

          {editing && isAssignee ? (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label>Title</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Priority</Label>
                <select
                  className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                >
                  {data.task_priorities.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Repeat</Label>
                <select
                  className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
                  value={editForm.recurrence}
                  onChange={(e) => setEditForm({ ...editForm, recurrence: e.target.value })}
                >
                  {data.task_recurrence.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              {editForm.recurrence === "custom" && (
                <div className="flex flex-col gap-1">
                  <Label>Every (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.recurrence_interval_days}
                    onChange={(e) =>
                      setEditForm({ ...editForm, recurrence_interval_days: e.target.value })
                    }
                  />
                </div>
              )}
              {editForm.recurrence !== "none" && (
                <div className="flex flex-col gap-1">
                  <Label>Repeat until (optional)</Label>
                  <Input
                    type="date"
                    value={editForm.recurrence_end_date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, recurrence_end_date: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="md:col-span-2 flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEdits}>Save changes</Button>
              </div>
            </div>
          ) : (
            <>
              {task.description && <p className="text-sm text-ui-fg-subtle">{task.description}</p>}
              {isAssignee && (
                <div className="flex gap-2">
                  <Button size="small" variant="secondary" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button size="small" variant="danger" onClick={deleteTask}>
                    Delete
                  </Button>
                </div>
              )}
            </>
          )}

          {isAssignee && (
            <AttachmentField
              label="Attachment"
              hint="Optional — receipt, photo, or invoice (JPEG, PNG, WebP, PDF)."
              url={task.attachment_url}
              uploading={uploadingAttachment}
              onUpload={handleAttachmentUpload}
              onClear={async () => {
                await update({ attachment_url: null })
                toast.success("Attachment removed")
              }}
            />
          )}

          {isAssignee && (
            <div className="flex gap-2">
              <Input
                placeholder="Add comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!comment.trim()) return
                  await update({ comment: comment.trim() })
                  setComment("")
                  toast.success("Comment added")
                }}
              >
                Comment
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-ui-fg-subtle">Activity</p>
            {[...task.activity].reverse().map((entry) => (
              <p key={entry.id} className="text-xs text-ui-fg-subtle">
                {formatDate(entry.created_at)} · {entry.actor} · {activityLabel(entry)}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TasksTab({
  data,
  currentUser,
  saving,
  setSaving,
  onRefresh,
}: {
  data: BudgetDashboardData
  currentUser: string
  saving: boolean
  setSaving: (v: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: data.founder_options[0]?.name ?? "",
    due_date: "",
    priority: "medium",
    recurrence: "none",
    recurrence_interval_days: "",
    recurrence_end_date: "",
  })
  const [assigneeFilter, setAssigneeFilter] = useState("all")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) {
      toast.error("Select who you are (top right)")
      return
    }
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (form.recurrence === "custom" && !form.recurrence_interval_days) {
      toast.error("Enter how many days between repeats")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          assigned_to: form.assigned_to,
          created_by: currentUser,
          due_date: form.due_date || undefined,
          priority: form.priority,
          recurrence: form.recurrence,
          recurrence_interval_days:
            form.recurrence === "custom" ? Number(form.recurrence_interval_days) : undefined,
          recurrence_end_date: form.recurrence_end_date || undefined,
        }),
      })
      toast.success("Task created")
      setForm({ ...form, title: "", description: "" })
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  const tasks = data.tasks.filter(
    (t) =>
      t.status !== "cancelled" &&
      (assigneeFilter === "all" || t.assigned_to === assigneeFilter)
  )

  return (
    <div className="flex flex-col gap-6">
      <form
        noValidate
        onSubmit={submit}
        className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base grid md:grid-cols-2 gap-4"
      >
        <div className="md:col-span-2">
          <Heading level="h2">Assign task</Heading>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label>Description</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Assign to</Label>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
          >
            {data.founder_options.map((f) => (
              <option key={f.key} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Due date</Label>
          <Input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Priority</Label>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            {data.task_priorities.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Repeat</Label>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={form.recurrence}
            onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
          >
            {data.task_recurrence.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {form.recurrence === "custom" && (
          <div className="flex flex-col gap-1">
            <Label>Every (days)</Label>
            <Input
              type="number"
              min={1}
              value={form.recurrence_interval_days}
              onChange={(e) => setForm({ ...form, recurrence_interval_days: e.target.value })}
            />
          </div>
        )}
        {form.recurrence !== "none" && (
          <div className="flex flex-col gap-1">
            <Label>Repeat until (optional)</Label>
            <Input
              type="date"
              value={form.recurrence_end_date}
              onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })}
            />
          </div>
        )}
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" isLoading={saving}>
            Create task
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <Heading level="h2">Tasks</Heading>
        <select
          className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
        >
          <option value="all">All founders</option>
          {data.founder_options.map((f) => (
            <option key={f.key} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-ui-fg-subtle">No open tasks.</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              data={data}
              currentUser={currentUser}
              onRefresh={onRefresh}
            />
          ))
        )}
      </div>
    </div>
  )
}
