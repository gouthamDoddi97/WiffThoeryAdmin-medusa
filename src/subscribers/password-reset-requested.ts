import { INotificationModuleService, ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

type PasswordResetData = {
  entity_id: string   // customer ID or email depending on Medusa version
  token: string
  actor_type: string
}

const STOREFRONT_URL = process.env.STOREFRONT_URL?.replace(/\/+$/, "") ?? ""

export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetData>) {
  const notificationService = container.resolve<INotificationModuleService>(
    Modules.NOTIFICATION
  )
  const customerService = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  )

  // entity_id may be an email or a customer ID depending on Medusa version
  let recipientEmail = data.entity_id
  if (!recipientEmail.includes("@")) {
    // looks like an ID — look up the customer
    try {
      const customer = await customerService.retrieveCustomer(data.entity_id)
      recipientEmail = customer.email
    } catch (e) {
      console.error("[password-reset] Failed to retrieve customer", e)
      return
    }
  }

  const resetUrl = `${STOREFRONT_URL}/account?action=reset_password&token=${encodeURIComponent(data.token)}&email=${encodeURIComponent(recipientEmail)}`

  try {
    await notificationService.createNotifications({
      to: recipientEmail,
      channel: "email",
      template: "password-reset",
      data: { url: resetUrl, token: data.token },
    })
  } catch (e) {
    console.error("[password-reset] Failed to send password reset email", e)
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
