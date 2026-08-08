import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { runRazorpayOrderAutomation } from "../lib/order/automation"

/**
 * After a Razorpay checkout order is placed, capture payment in Medusa automatically.
 * Fulfillment stays manual in Admin (pack box + stickers).
 */
export default async function orderRazorpayAutomationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await runRazorpayOrderAutomation(container, data.id)
  } catch (e) {
    console.error("[order-razorpay-automation] Failed", e)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
