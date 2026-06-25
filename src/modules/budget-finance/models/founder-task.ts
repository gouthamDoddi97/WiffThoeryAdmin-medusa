import { model } from "@medusajs/framework/utils"

const FounderTask = model.define("budget_founder_task", {
  id: model.id().primaryKey(),
  title: model.text(),
  description: model.text().nullable(),
  assigned_to: model.text(),
  created_by: model.text(),
  due_date: model.dateTime().nullable(),
  status: model.text().default("todo"),
  priority: model.text().default("medium"),
  recurrence: model.text().default("none"),
  recurrence_interval_days: model.number().nullable(),
  recurrence_end_date: model.dateTime().nullable(),
  plan_id: model.text().nullable(),
  is_milestone: model.boolean().default(false),
  attachment_url: model.text().nullable(),
})

export default FounderTask
