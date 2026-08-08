import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  updateCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { MedusaContainer } from "@medusajs/framework/types"
import {
  checkShiprocketServiceability,
  ShiprocketCourier,
} from "./client"
import {
  computeCartWeightKg,
  estimateCartWeightKg,
  type ShiprocketWeightLine,
} from "./cart-weight"
import { shiprocketRateToMedusaShippingAmount } from "../currency/inr-amounts"
import { isShiprocketConfigured, isShiprocketDemoMode } from "../integrations/config"

export { shiprocketRateToMedusaShippingAmount } from "../currency/inr-amounts"
export {
  computeCartWeightKg,
  estimateCartWeightKg,
  type ShiprocketWeightLine,
} from "./cart-weight"

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

const SERVICEABILITY_CACHE_TTL_MS = 5 * 60 * 1000
type ServiceabilityCacheEntry = {
  expiresAt: number
  couriers: ShiprocketCourierOption[]
}
const serviceabilityCache = new Map<string, ServiceabilityCacheEntry>()

function serviceabilityCacheKey(pincode: string, weightKg: number): string {
  return `${pincode}:${weightKg.toFixed(2)}`
}

function normalizeCouriers(couriers: ShiprocketCourier[]): ShiprocketCourierOption[] {
  return couriers
    .filter((c) => c.courier_name && Number.isFinite(c.rate))
    .map((c) => ({
      ...c,
      label: c.courier_name,
    }))
    .sort(
      (a, b) =>
        a.rate - b.rate ||
        (a.estimated_delivery_days ?? 99) - (b.estimated_delivery_days ?? 99)
    )
}

export async function listShiprocketCouriersForPincode(
  pincode: string,
  weightKg?: number,
  options?: { skipCache?: boolean }
): Promise<ShiprocketCourierOption[]> {
  if (!isShiprocketConfigured()) {
    return []
  }

  if (isShiprocketDemoMode()) {
    return DEMO_COURIERS
  }

  const weight = weightKg ?? Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG ?? "0.35")
  const cacheKey = serviceabilityCacheKey(pincode, weight)

  if (!options?.skipCache) {
    const cached = serviceabilityCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.couriers
    }
  }

  const couriers = normalizeCouriers(
    await checkShiprocketServiceability(pincode, weight)
  )

  serviceabilityCache.set(cacheKey, {
    expiresAt: Date.now() + SERVICEABILITY_CACHE_TTL_MS,
    couriers,
  })

  return couriers
}

type SelectCourierInput = {
  cartId: string
  courierCompanyId: number
  pincode: string
  /** When provided (from checkout list), skip a live Shiprocket re-fetch. */
  courier?: Pick<
    ShiprocketCourier,
    "courier_name" | "rate" | "etd" | "estimated_delivery_days"
  >
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
      "items.quantity",
      "items.metadata",
      "items.variant.weight",
      "items.product.weight",
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
        items?: Array<ShiprocketWeightLine> | null
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

  const weightKg = computeCartWeightKg(cart.items)

  let courier: ShiprocketCourierOption | undefined

  if (input.courier?.courier_name && Number.isFinite(input.courier.rate)) {
    courier = {
      courier_company_id: input.courierCompanyId,
      courier_name: input.courier.courier_name,
      rate: input.courier.rate,
      etd: input.courier.etd,
      estimated_delivery_days: input.courier.estimated_delivery_days,
      label: input.courier.courier_name,
    }
  } else {
    const couriers = await listShiprocketCouriersForPincode(pincode, weightKg)
    courier = couriers.find(
      (c) => c.courier_company_id === input.courierCompanyId
    )
  }

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

  const medusaAmount = shiprocketRateToMedusaShippingAmount(courier.rate)
  const shippingMethodName = `${courier.courier_name} via Shiprocket`

  const existingIds =
    cart.shipping_methods?.map((m) => m.id).filter(Boolean) ?? []
  if (existingIds.length) {
    await cartModule.deleteShippingMethods(existingIds)
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

  let refreshedCart = await cartModule.retrieveCart(cart.id, {
    relations: ["shipping_methods"],
  })

  let shippingMethod = refreshedCart.shipping_methods?.at(-1)
  if (!shippingMethod?.id) {
    throw new Error("Failed to apply shipping method")
  }

  const applyShiprocketRate = async (methodId: string) => {
    await cartModule.updateShippingMethods([
      {
        id: methodId,
        name: shippingMethodName,
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
  }

  await applyShiprocketRate(shippingMethod.id)

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
