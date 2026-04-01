import { INotificationModuleService, IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const notificationService = container.resolve<INotificationModuleService>(
    Modules.NOTIFICATION
  )
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  let order: Awaited<ReturnType<typeof orderService.retrieveOrder>>
  try {
    order = await orderService.retrieveOrder(data.id, {
      relations: ["items"],
    })
  } catch (e) {
    console.error("[order-placed] Failed to retrieve order", e)
    return
  }

  if (!order.email) {
    console.warn(`[order-placed] Order ${data.id} has no email, skipping notification`)
    return
  }

  try {
    await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-confirmed",
      data: { order },
    })
  } catch (e) {
    console.error("[order-placed] Failed to send order confirmation email", e)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
