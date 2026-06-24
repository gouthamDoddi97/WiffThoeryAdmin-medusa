import { Button, Heading, Input, Label, toast } from "@medusajs/ui"
import { useState } from "react"
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
    case "reassigned":
      return `Reassigned ${d.from} → ${d.to}`
    case "status_changed":
      return `Status ${d.from} → ${d.to}`
    case "due_date_changed":
      return `Due date updated`
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
  const [comment, setComment] = useState("")
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  const update = async (patch: Record<string, unknown>) => {
    if (!currentUser) {
      toast.error("Select who you are (top right)")
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
    const message = task.is_milestone
      ? `Mark milestone "${task.title}" as done? Any linked plan will no longer be blocked by this milestone.`
      : `Mark "${task.title}" as done?`
    if (!window.confirm(message)) return
    await update({ status: "done" })
  }

  return (
    <div className={`border rounded-xl p-4 bg-ui-bg-base ${task.is_overdue ? "border-red-400" : "border-ui-border-base"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {task.is_milestone ? "◆ " : ""}{task.title}
          </p>
          <p className="text-xs text-ui-fg-subtle mt-1">
            {task.assigned_to} · {labelFor(data.task_statuses, task.status)} · {labelFor(data.task_priorities, task.priority)}
            {task.due_date ? ` · Due ${formatDate(task.due_date)}` : ""}
            {task.plan_title ? ` · Plan: ${task.plan_title}` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {task.status === "todo" && (
            <Button size="small" variant="secondary" onClick={() => update({ status: "in_progress" })}>
              Start
            </Button>
          )}
          {task.status !== "done" && task.status !== "cancelled" && (
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
          {task.description && <p className="text-sm text-ui-fg-subtle">{task.description}</p>}

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

          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Reassign to</Label>
              <select
                className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
                value={task.assigned_to}
                onChange={(e) => update({ assigned_to: e.target.value })}
              >
                {data.founder_options.map((f) => (
                  <option key={f.key} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Link to plan</Label>
              <select
                className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
                value={task.plan_id ?? ""}
                onChange={(e) => update({ plan_id: e.target.value || null })}
              >
                <option value="">None</option>
                {data.plans.filter((p) => p.status === "active" || p.status === "draft").map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Input placeholder="Add comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
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
    plan_id: "",
    is_milestone: false,
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
    setSaving(true)
    try {
      await api("/admin/budget/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          created_by: currentUser,
          plan_id: form.plan_id || undefined,
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
      <form noValidate onSubmit={submit} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><Heading level="h2">Assign task</Heading></div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label>Description</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Assign to</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
            {data.founder_options.map((f) => (
              <option key={f.key} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Due date</Label>
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Priority</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {data.task_priorities.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Plan (optional)</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>
            <option value="">None</option>
            {data.plans.filter((p) => p.status === "active" || p.status === "draft").map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={form.is_milestone} onChange={(e) => setForm({ ...form, is_milestone: e.target.checked })} />
          Milestone (blocks plan until done)
        </label>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" isLoading={saving}>Create task</Button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <Heading level="h2">Tasks</Heading>
        <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="all">All founders</option>
          {data.founder_options.map((f) => (
            <option key={f.key} value={f.name}>{f.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-ui-fg-subtle">No open tasks.</p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} data={data} currentUser={currentUser} onRefresh={onRefresh} />
          ))
        )}
      </div>
    </div>
  )
}
