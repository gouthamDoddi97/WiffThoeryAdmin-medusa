import {
  isShiprocketConfigured,
  isShiprocketDemoMode,
  getShiprocketPassword,
} from "../integrations/config"

const API_BASE = "https://apiv2.shiprocket.in/v1/external"

export type ShiprocketOrderInput = {
  medusaOrderId: string
  displayId: number
  orderDate: string
  email: string
  phone: string
  shipping: {
    firstName: string
    lastName?: string
    address1: string
    address2?: string
    city: string
    province?: string
    postalCode: string
    countryCode: string
  }
  items: Array<{
    title: string
    sku?: string
    quantity: number
    unitPrice: number
  }>
  subtotal: number
  paymentMethod: "Prepaid" | "COD"
}

export type ShiprocketCreateResult = {
  demo: boolean
  shiprocket_order_id?: number
  channel_order_id: string
  awb?: string
  message?: string
}

type TokenCache = { token: string; expiresAt: number }
let tokenCache: TokenCache | null = null

export type ShiprocketPickupInput = {
  pickup_location: string
  name: string
  email: string
  phone: string
  address: string
  address_2?: string
  city: string
  state: string
  country: string
  pin_code: string
}

export type ShiprocketPickupResult = {
  pickup_id?: number
  pickup_location: string
  pickup_code?: string
}

async function shiprocketFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getAuthToken()
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
}

export async function getShiprocketPickups(): Promise<unknown> {
  const res = await shiprocketFetch("/settings/company/pickup")
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Shiprocket get pickups failed (${res.status}): ${body}`)
  }
  return res.json()
}

type PickupEntry = { pickup_location?: string; name?: string }

/** Collect pickup nicknames from all known Shiprocket pickup API shapes. */
export function parseShiprocketPickupNicknames(response: unknown): Set<string> {
  const nicknames = new Set<string>()
  const add = (value?: string | null) => {
    const trimmed = value?.trim()
    if (trimmed) nicknames.add(trimmed.toLowerCase())
  }

  const data = (response as { data?: Record<string, unknown> })?.data
  if (!data) return nicknames

  const shipping = data.shipping_address
  if (Array.isArray(shipping)) {
    for (const entry of shipping as PickupEntry[]) {
      add(entry.pickup_location ?? entry.name)
    }
  } else if (shipping && typeof shipping === "object") {
    const entry = shipping as PickupEntry
    add(entry.pickup_location ?? entry.name)
  }

  const recent = data.recent_addresses
  if (Array.isArray(recent)) {
    for (const entry of recent as PickupEntry[]) {
      add(entry.pickup_location ?? entry.name)
    }
  }

  return nicknames
}

export async function createShiprocketPickup(
  input: ShiprocketPickupInput
): Promise<ShiprocketPickupResult> {
  const res = await shiprocketFetch("/settings/company/addpickup", {
    method: "POST",
    body: JSON.stringify(input),
  })

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Shiprocket add pickup failed (${res.status}): ${body}`)
  }

  const data = JSON.parse(body) as {
    pickup_id?: number
    address?: { pickup_code?: string }
  }

  return {
    pickup_id: data.pickup_id,
    pickup_location: input.pickup_location,
    pickup_code: data.address?.pickup_code,
  }
}

async function getAuthToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }

  const email = process.env.SHIPROCKET_EMAIL
  const password = getShiprocketPassword()
  if (!email || !password) {
    throw new Error("Shiprocket credentials are not configured")
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Shiprocket auth failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as { token?: string }
  if (!data.token) {
    throw new Error("Shiprocket auth response missing token")
  }

  tokenCache = {
    token: data.token,
    expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000,
  }

  return data.token
}

function buildPayload(input: ShiprocketOrderInput) {
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION ?? "Primary"
  const weightKg = Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG ?? "0.35")
  const length = Number(process.env.SHIPROCKET_DEFAULT_LENGTH_CM ?? "12")
  const breadth = Number(process.env.SHIPROCKET_DEFAULT_BREADTH_CM ?? "12")
  const height = Number(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM ?? "8")

  return {
    order_id: `WT-${input.displayId}`,
    order_date: input.orderDate,
    pickup_location: pickupLocation,
    channel_id: process.env.SHIPROCKET_CHANNEL_ID
      ? Number(process.env.SHIPROCKET_CHANNEL_ID)
      : undefined,
    comment: `Medusa order ${input.medusaOrderId}`,
    billing_customer_name: input.shipping.firstName,
    billing_last_name: input.shipping.lastName ?? "",
    billing_address: input.shipping.address1,
    billing_address_2: input.shipping.address2 ?? "",
    billing_city: input.shipping.city,
    billing_pincode: input.shipping.postalCode,
    billing_state: input.shipping.province ?? "",
    billing_country: input.shipping.countryCode.toLowerCase() === "in" ? "India" : input.shipping.countryCode,
    billing_email: input.email,
    billing_phone: input.phone,
    shipping_is_billing: true,
    order_items: input.items.map((item) => ({
      name: item.title,
      sku: item.sku ?? item.title.slice(0, 40),
      units: item.quantity,
      selling_price: item.unitPrice,
      discount: 0,
      tax: 0,
      hsn: process.env.SHIPROCKET_DEFAULT_HSN ?? "",
    })),
    payment_method: input.paymentMethod,
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: input.subtotal,
    length,
    breadth,
    height,
    weight: weightKg,
  }
}

export async function createShiprocketOrder(
  input: ShiprocketOrderInput
): Promise<ShiprocketCreateResult> {
  const channelOrderId = `WT-${input.displayId}`

  if (isShiprocketDemoMode()) {
    const demoResult: ShiprocketCreateResult = {
      demo: true,
      channel_order_id: channelOrderId,
      shiprocket_order_id: Math.floor(Math.random() * 900000) + 100000,
      awb: `DEMO${Date.now().toString().slice(-8)}`,
      message: isShiprocketConfigured()
        ? "Demo mode enabled — shipment not sent to Shiprocket"
        : "Shiprocket credentials missing — demo shipment logged",
    }
    console.info("[shiprocket:demo]", JSON.stringify({ input, demoResult }, null, 2))
    return demoResult
  }

  const token = await getAuthToken()
  const payload = buildPayload(input)

  const res = await fetch(`${API_BASE}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Shiprocket create order failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    order_id?: number
    shipment_id?: number
    awb_code?: string
  }

  return {
    demo: false,
    channel_order_id: channelOrderId,
    shiprocket_order_id: data.order_id,
    awb: data.awb_code,
  }
}
