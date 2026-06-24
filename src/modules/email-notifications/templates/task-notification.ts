import { adminBudgetUrl } from "../email-urls"

function layout(content: string): string {  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Whiff Theory — Task</title>
</head>
<body style="margin:0;padding:0;background:#0f1017;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1017;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1c28;border:1px solid rgba(255,255,255,0.06);">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:13px;font-weight:700;letter-spacing:0.2em;color:#ffffff;">WHIFF THEORY · BUDGET</span>
          </td>
        </tr>
        <tr><td style="padding:40px 40px 32px;">${content}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatDueDate(value: unknown): string {
  if (!value) return "No due date"
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(String(value)))
  } catch {
    return String(value)
  }
}

export function taskNotificationTemplate(data: Record<string, unknown>): string {
  const event = String(data.event ?? "updated")
  const task = (data.task ?? {}) as Record<string, unknown>
  const changes = (data.changes ?? []) as string[]
  const actor = esc(data.actor)
  const planTitle = data.plan_title ? esc(data.plan_title) : null
  const title = esc(task.title)
  const assignedTo = esc(task.assigned_to)
  const status = esc(task.status)
  const priority = esc(task.priority)
  const dueDate = formatDueDate(task.due_date)
  const description = task.description ? esc(task.description) : null
  const isMilestone = Boolean(task.is_milestone)
  const headline = event === "created" ? "New task assigned to you" : "Task updated"

  const changeBlock =
    changes.length > 0
      ? `<ul style="margin:16px 0 0;padding-left:20px;color:rgba(255,255,255,0.75);font-size:14px;line-height:1.6;">
          ${changes.map((line) => `<li>${esc(line)}</li>`).join("")}
        </ul>`
      : ""

  const content = `
    <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:0.08em;text-transform:uppercase;">${headline}</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#ffffff;line-height:1.3;">${title}</h1>
    <p style="margin:0 0 6px;font-size:14px;color:rgba(255,255,255,0.65);"><strong style="color:#fff;">Assigned to:</strong> ${assignedTo}</p>
    <p style="margin:0 0 6px;font-size:14px;color:rgba(255,255,255,0.65);"><strong style="color:#fff;">Status:</strong> ${status} · <strong style="color:#fff;">Priority:</strong> ${priority}</p>
    <p style="margin:0 0 6px;font-size:14px;color:rgba(255,255,255,0.65);"><strong style="color:#fff;">Due:</strong> ${dueDate}${isMilestone ? " · Milestone" : ""}</p>
    ${planTitle ? `<p style="margin:0 0 6px;font-size:14px;color:rgba(255,255,255,0.65);"><strong style="color:#fff;">Plan:</strong> ${planTitle}</p>` : ""}
    ${description ? `<p style="margin:16px 0 0;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.5;">${description}</p>` : ""}
    ${event !== "created" && actor ? `<p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.45);">Updated by ${actor}</p>` : ""}
    ${changeBlock}
    <p style="margin:28px 0 0;">
      <a href="${adminBudgetUrl()}" style="display:inline-block;padding:12px 20px;background:#ffffff;color:#0f1017;text-decoration:none;font-size:13px;font-weight:600;border-radius:6px;">Open Budget &amp; Tasks</a>
    </p>
  `

  return layout(content)
}
