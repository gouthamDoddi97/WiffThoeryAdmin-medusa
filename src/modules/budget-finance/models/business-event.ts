import { model } from "@medusajs/framework/utils"

const BusinessEvent = model.define("budget_business_event", {
  id: model.id().primaryKey(),
  name: model.text(),
  event_date: model.dateTime(),
  location: model.text().nullable(),
  notes: model.text().nullable(),
})

export default BusinessEvent
