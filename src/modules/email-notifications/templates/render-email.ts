import { orderConfirmedTemplate } from "./order-confirmed"
import { passwordResetTemplate } from "./password-reset"
import { taskNotificationTemplate } from "./task-notification"
import { welcomeTemplate } from "./welcome"

export function renderEmail(
  template: string,
  data: Record<string, unknown>
): { subject: string; html: string } | null {
  switch (template) {
    case "order-confirmed":
      return {
        subject: "Your Whiff Theory order is confirmed",
        html: orderConfirmedTemplate(data),
      }
    case "password-reset":
      return {
        subject: "Reset your Whiff Theory password",
        html: passwordResetTemplate(data),
      }
    case "welcome":
      return {
        subject: "Welcome to Whiff Theory",
        html: welcomeTemplate(data),
      }
    case "task-assigned":
      return {
        subject: `[Whiff Theory] New task: ${(data.task as { title?: string })?.title ?? "Assigned to you"}`,
        html: taskNotificationTemplate({ ...data, event: "created" }),
      }
    case "task-updated":
      return {
        subject: `[Whiff Theory] Task updated: ${(data.task as { title?: string })?.title ?? "Task"}`,
        html: taskNotificationTemplate({ ...data, event: "updated" }),
      }
    default:
      return null
  }
}
