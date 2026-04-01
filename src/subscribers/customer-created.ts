import { INotificationModuleService, ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const notificationService = container.resolve<INotificationModuleService>(
    Modules.NOTIFICATION
  )
  const customerService = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  )

  let customer: Awaited<ReturnType<typeof customerService.retrieveCustomer>>
  try {
    customer = await customerService.retrieveCustomer(data.id)
  } catch (e) {
    console.error("[customer-created] Failed to retrieve customer", e)
    return
  }

  if (!customer.email) {
    console.warn(`[customer-created] Customer ${data.id} has no email, skipping notification`)
    return
  }

  try {
    await notificationService.createNotifications({
      to: customer.email,
      channel: "email",
      template: "welcome",
      data: {
        first_name: customer.first_name ?? undefined,
        customer,
      },
    })
  } catch (e) {
    console.error("[customer-created] Failed to send welcome email", e)
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
