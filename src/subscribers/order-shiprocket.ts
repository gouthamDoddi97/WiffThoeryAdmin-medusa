import { IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { createShiprocketOrder } from "../lib/shiprocket/client"

export default async function orderShiprocketHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  let order: Awaited<ReturnType<typeof orderService.retrieveOrder>>
  try {
    order = await orderService.retrieveOrder(data.id, {
      relations: ["items", "shipping_address"],
    })
  } catch (e) {
    console.error("[order-shiprocket] Failed to retrieve order", e)
    return
  }

  const shipping = order.shipping_address
  if (!shipping?.address_1 || !shipping.postal_code || !shipping.city) {
    console.warn(
      `[order-shiprocket] Order ${data.id} missing shipping address, skipping`
    )
    return
  }

  if (!order.email) {
    console.warn(`[order-shiprocket] Order ${data.id} has no email, skipping`)
    return
  }

  const phone =
    shipping.phone ??
    (order.metadata?.phone as string | undefined) ??
    ""

  if (!phone) {
    console.warn(
      `[order-shiprocket] Order ${data.id} has no phone on shipping address — add phone at checkout for Shiprocket`
    )
  }

  const subtotal =
    order.items?.reduce((sum, line) => {
      const unit = Number(line.unit_price ?? 0)
      return sum + unit * (line.quantity ?? 1)
    }, 0) ?? 0

  try {
    const result = await createShiprocketOrder({
      medusaOrderId: order.id,
      displayId: order.display_id,
      orderDate: new Date(order.created_at).toISOString().slice(0, 10),
      email: order.email,
      phone: phone || "0000000000",
      shipping: {
        firstName: shipping.first_name ?? "Customer",
        lastName: shipping.last_name ?? undefined,
        address1: shipping.address_1,
        address2: shipping.address_2 ?? undefined,
        city: shipping.city,
        province: shipping.province ?? undefined,
        postalCode: shipping.postal_code,
        countryCode: shipping.country_code ?? "in",
      },
      items:
        order.items?.map((line) => ({
          title: line.title ?? line.product_title ?? "Fragrance",
          sku: line.variant_sku ?? undefined,
          quantity: line.quantity ?? 1,
          unitPrice: Math.round(Number(line.unit_price ?? 0) / 100),
        })) ?? [],
      subtotal: Math.round(subtotal / 100),
      paymentMethod: "Prepaid",
    })

    await orderService.updateOrders(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        shiprocket: {
          demo: result.demo,
          channel_order_id: result.channel_order_id,
          shiprocket_order_id: result.shiprocket_order_id,
          awb: result.awb,
          synced_at: new Date().toISOString(),
          message: result.message,
        },
      },
    })

    console.info(
      `[order-shiprocket] ${result.demo ? "Demo" : "Live"} shipment for order ${order.display_id}:`,
      result.awb ?? result.channel_order_id
    )
  } catch (e) {
    console.error("[order-shiprocket] Failed to create shipment", e)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
