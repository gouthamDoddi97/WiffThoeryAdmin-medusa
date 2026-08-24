import { Modules } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  assignShiprocketAwb,
  checkShiprocketServiceability,
  createShiprocketOrder,
  pickCourierForMethod,
} from "../lib/shiprocket/client"
import { computeCartWeightKg } from "../lib/shiprocket/cart-weight"

type OrderShiprocketSelection = {
  courier_company_id?: number
  courier_name?: string
  rate_inr?: number
  weight_kg?: number
  etd?: string
  estimated_delivery_days?: number
  pincode?: string
}

/** Shape loaded from query.graph / order module for Shiprocket sync. */
type OrderShiprocketRow = {
  id: string
  /** Medusa query returns display_id as string; order module may use number. */
  display_id?: number | string
  email?: string | null
  created_at?: string | Date
  metadata?: Record<string, unknown> | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    province?: string | null
    postal_code?: string | null
    country_code?: string | null
    phone?: string | null
  } | null
  shipping_methods?: Array<{ name?: string | null }> | null
  items?: Array<{
    title?: string | null
    product_title?: string | null
    variant_sku?: string | null
    quantity?: number | null
    unit_price?: number | null
    variant?: { weight?: number | null } | null
    product?: { weight?: number | null } | null
  }> | null
  customer?: { email?: string | null } | null
}

export default async function orderShiprocketHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderService = container.resolve(Modules.ORDER)

  let order: OrderShiprocketRow

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "created_at",
        "metadata",
        "shipping_address.*",
        "shipping_methods.*",
        "items.*",
        "items.variant.weight",
        "items.product.weight",
        "customer.*",
      ],
      filters: { id: data.id },
    })
    const row = orders?.[0] as OrderShiprocketRow | undefined
    if (!row?.id) {
      throw new Error(`Order ${data.id} not found`)
    }
    order = row

    // Query sometimes omits linked address — fall back to order module.
    if (!order.shipping_address?.address_1) {
      const viaModule = await orderService.retrieveOrder(data.id, {
        relations: ["items", "shipping_address", "shipping_methods"],
      })
      order = {
        ...order,
        email: order.email ?? viaModule.email,
        display_id: order.display_id ?? viaModule.display_id,
        shipping_address: viaModule.shipping_address,
        shipping_methods: viaModule.shipping_methods,
        items: viaModule.items,
        metadata: (order.metadata ?? viaModule.metadata) as Record<
          string,
          unknown
        > | null,
      }
    }
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

  const email = order.email ?? order.customer?.email ?? null
  if (!email) {
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

  const existingShiprocket = order.metadata?.shiprocket as
    | (OrderShiprocketSelection & {
        shiprocket_order_id?: number
        synced_at?: string
        demo?: boolean
      })
    | undefined

  // Don't re-create if we already pushed a live Shiprocket order.
  if (
    existingShiprocket?.shiprocket_order_id &&
    existingShiprocket.synced_at &&
    existingShiprocket.demo === false
  ) {
    console.info(
      `[order-shiprocket] Order ${order.display_id} already synced live — skipping`
    )
    return
  }

  const subtotal =
    order.items?.reduce((sum, line) => {
      const unit = Number(line.unit_price ?? 0)
      return sum + unit * (line.quantity ?? 1)
    }, 0) ?? 0

  const shippingMethodName = order.shipping_methods?.[0]?.name ?? undefined
  const shiprocketSelection = existingShiprocket
  const weightKg =
    Number(shiprocketSelection?.weight_kg) > 0
      ? Number(shiprocketSelection?.weight_kg)
      : computeCartWeightKg(order.items)

  const shippingChargesInr = Math.round(Number(shiprocketSelection?.rate_inr ?? 0))

  try {
    const result = await createShiprocketOrder({
      medusaOrderId: order.id,
      displayId: Number(order.display_id ?? 0),
      orderDate: new Date(order.created_at ?? Date.now())
        .toISOString()
        .slice(0, 10),
      email,
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
          unitPrice: Math.round(Number(line.unit_price ?? 0)),
        })) ?? [],
      subtotal: Math.round(subtotal),
      paymentMethod: "Prepaid",
      shippingMethod: shippingMethodName,
      weightKg,
      shippingChargesInr,
    })

    const shouldAssignAwb =
      !result.demo &&
      result.shipment_id &&
      (shiprocketSelection?.courier_company_id ||
        process.env.SHIPROCKET_AUTO_ASSIGN_AWB === "true")

    if (shouldAssignAwb && result.shipment_id) {
      const shipmentId = result.shipment_id
      try {
        let courierId = shiprocketSelection?.courier_company_id
        let courierName = shiprocketSelection?.courier_name

        if (!courierId) {
          const couriers = await checkShiprocketServiceability(
            shipping.postal_code,
            weightKg
          )
          const isExpress = /express/i.test(shippingMethodName ?? "")
          const picked = pickCourierForMethod(
            couriers,
            isExpress ? "express" : "standard"
          )
          courierId = picked?.courier_company_id
          courierName = picked?.courier_name
        }

        if (courierId) {
          const assigned = await assignShiprocketAwb(shipmentId, courierId)
          result.awb = assigned.awb ?? result.awb
          result.courier = assigned.courier ?? courierName ?? result.courier
          console.info(
            `[order-shiprocket] AWB assigned via ${result.courier}: ${result.awb}`
          )
        }
      } catch (e) {
        console.warn(
          "[order-shiprocket] Courier assign failed — assign manually in Shiprocket dashboard",
          e
        )
      }
    }

    await orderService.updateOrders(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        shiprocket: {
          ...shiprocketSelection,
          demo: result.demo,
          channel_order_id: result.channel_order_id,
          shiprocket_order_id: result.shiprocket_order_id,
          shipment_id: result.shipment_id,
          awb: result.awb,
          courier: result.courier,
          shipping_method: shippingMethodName,
          customer_courier_id: shiprocketSelection?.courier_company_id,
          customer_courier_name: shiprocketSelection?.courier_name,
          customer_rate_inr: shiprocketSelection?.rate_inr,
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
    const message = e instanceof Error ? e.message : String(e)
    console.error("[order-shiprocket] Failed to create shipment", e)
    try {
      await orderService.updateOrders(order.id, {
        metadata: {
          ...(order.metadata ?? {}),
          shiprocket: {
            ...shiprocketSelection,
            sync_error: message,
            sync_failed_at: new Date().toISOString(),
          },
        },
      })
    } catch (updateError) {
      console.error(
        "[order-shiprocket] Also failed to persist sync_error metadata",
        updateError
      )
    }
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
