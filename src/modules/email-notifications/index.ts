import NodemailerNotificationService from "./service"
import { Module } from "@medusajs/framework/utils"

export const EMAIL_NOTIFICATIONS_MODULE = "emailNotifications"

export default Module(EMAIL_NOTIFICATIONS_MODULE, {
  service: NodemailerNotificationService,
})
