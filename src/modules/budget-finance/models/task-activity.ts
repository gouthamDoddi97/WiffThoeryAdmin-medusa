import { model } from "@medusajs/framework/utils"

const TaskActivity = model.define("budget_task_activity", {
  id: model.id().primaryKey(),
  task_id: model.text(),
  action: model.text(),
  actor: model.text(),
  details: model.json().nullable(),
})

export default TaskActivity
