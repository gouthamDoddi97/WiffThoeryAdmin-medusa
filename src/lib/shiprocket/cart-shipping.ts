import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  refreshCartItemsWorkflow,
  updateCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { MedusaContainer } from "@medusajs/framework/types"
import {
  checkShiprocketServiceability,
  ShiprocketCourier,
} from "./client"
import { isShiprocketConfigured, isShiprocketDemoMode } from "../integrations/config"

export type ShiprocketCourierOption = ShiprocketCourier & {
  /** Display label for checkout */
  label: string
}

const DEMO_COURIERS: ShiprocketCourierOption[] = [
  {
    courier_company_id: 9001,
    courier_name: "Delhivery Surface",
    rate: 65,
    estimated_delivery_days: 4,
    etd: "4-5 days",
    label: "Delhivery Surface",
  },
  {
    courier_company_id: 9002,
    courier_name: "Blue Dart Air",
    rate: 120,
    estimated_delivery_days: 2,
    etd: "2-3 days",
    label: "Blue Dart Air",
  },
  {
    courier_company_id: 9003,
    courier_name: "DTDC Express",
    rate: 85,
    estimated_delivery_days: 3,
    etd: "3-4 days",
    label: "DTDC Express",
  },
]

export function estimateCartWeightKg(itemCount: number): number {
  const perItem = Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG ?? "0.35")
  const base = Number(process.env.SHIPROCKET_MIN_WEIGHT_KG ?? "0.2")
  return Math.max(base, perItem * Math.max(1, itemCount))
}

/** Medusa INR shipping amounts use paise (9900 = ₹99) while items use rupees. */
export function shiprocketRateToMedusaShippingAmount(rateInr: number): number {
  return Math.round(rateInr * 100)
}

export function medusaShippingAmountToInr(amount: number, itemTotal: number): number {
  if (itemTotal > 0 && amount >= itemTotal * 10) {
    return amount / 100
  }
  return amount
}

export async function listShiprocketCouriersForPincode(
  pincode: string,
  weightKg?: number
): Promise<ShiprocketCourierOption[]> {
  if (!isShiprocketConfigured()) {
    return []
  }

  if (isShiprocketDemoMode()) {
    return DEMO_COURIERS
  }

  const couriers = await checkShiprocketServiceability(pincode, weightKg)
  return couriers
    .filter((c) => c.courier_name && Number.isFinite(c.rate))
    .map((c) => ({
      ...c,
      label: c.courier_name,
    }))
    .sort((a, b) => a.rate - b.rate || (a.estimated_delivery_days ?? 99) - (b.estimated_delivery_days ?? 99))
}

type SelectCourierInput = {
  cartId: string
  courierCompanyId: number
  pincode: string
}

export async function selectShiprocketCourierForCart(
  container: MedusaContainer,
  input: SelectCourierInput
): Promise<{ courier: ShiprocketCourierOption; cart_id: string }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cartModule = container.resolve(Modules.CART)

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "region_id",
      "item_total",
      "metadata",
      "*items",
      "*shipping_methods",
      "*shipping_address",
    ],
    filters: { id: input.cartId },
  })

  const cart = carts?.[0] as
    | {
        id: string
        currency_code?: string
        item_total?: number
        metadata?: Record<string, unknown> | null
        items?: Array<{ quantity?: number }> | null
        shipping_methods?: Array<{ id: string; shipping_option_id?: string }> | null
        shipping_address?: { postal_code?: string | null } | null
      }
    | undefined

  if (!cart) {
    throw new Error("Cart not found")
  }

  const pincode =
    input.pincode.trim() ||
    cart.shipping_address?.postal_code?.trim() ||
    ""

  if (!/^\d{6}$/.test(pincode)) {
    throw new Error("A valid 6-digit delivery pincode is required")
  }

  const itemCount =
    cart.items?.reduce((sum, line) => sum + (line.quantity ?? 1), 0) ?? 1
  const weightKg = estimateCartWeightKg(itemCount)

  const couriers = await listShiprocketCouriersForPincode(pincode, weightKg)
  const courier = couriers.find(
    (c) => c.courier_company_id === input.courierCompanyId
  )

  if (!courier) {
    throw new Error("Selected courier is not available for this pincode")
  }

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id"],
    filters: { provider_id: "manual_manual" },
  })

  const shippingOption = (shippingOptions as Array<{ id: string; name?: string }> | undefined)?.find(
    (o) => !/express/i.test(o.name ?? "")
  ) ?? (shippingOptions as Array<{ id: string }> | undefined)?.[0]

  if (!shippingOption?.id) {
    throw new Error("No shipping option configured — run setup-india-shipping.ts")
  }

  await addShippingMethodToCartWorkflow(container).run({
    input: {
      cart_id: cart.id,
      options: [
        {
          id: shippingOption.id,
          data: {
            shiprocket_courier_id: courier.courier_company_id,
            shiprocket_courier_name: courier.courier_name,
            shiprocket_rate_inr: courier.rate,
          },
        },
      ],
    },
  })

  const refreshedCart = await cartModule.retrieveCart(cart.id, {
    relations: ["shipping_methods"],
  })

  const shippingMethod = refreshedCart.shipping_methods?.at(-1)
  if (!shippingMethod?.id) {
    throw new Error("Failed to apply shipping method")
  }

  const medusaAmount = shiprocketRateToMedusaShippingAmount(courier.rate)

  await cartModule.updateShippingMethods([
    {
      id: shippingMethod.id,
      name: `${courier.courier_name} via Shiprocket`,
      amount: medusaAmount,
      is_tax_inclusive: true,
      data: {
        shiprocket_courier_id: courier.courier_company_id,
        shiprocket_courier_name: courier.courier_name,
        shiprocket_rate_inr: courier.rate,
        shiprocket_etd: courier.etd,
        shiprocket_estimated_days: courier.estimated_delivery_days,
      },
    },
  ])

  await refreshCartItemsWorkflow(container).run({
    input: { cart_id: cart.id },
  })

  await updateCartWorkflow(container).run({
    input: {
      id: cart.id,
      metadata: {
        ...(cart.metadata ?? {}),
        shiprocket: {
          courier_company_id: courier.courier_company_id,
          courier_name: courier.courier_name,
          rate_inr: courier.rate,
          etd: courier.etd,
          estimated_delivery_days: courier.estimated_delivery_days,
          pincode,
          weight_kg: weightKg,
          selected_at: new Date().toISOString(),
        },
      },
    },
  })

  return { courier, cart_id: cart.id }
}
