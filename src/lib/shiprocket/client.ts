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
  /** Medusa shipping option name (e.g. "Express Shipping") — recorded on the Shiprocket order. */
  shippingMethod?: string
}

export type ShiprocketCreateResult = {
  demo: boolean
  shiprocket_order_id?: number
  shipment_id?: number
  channel_order_id: string
  awb?: string
  courier?: string
  message?: string
}

export type ShiprocketCourier = {
  courier_company_id: number
  courier_name: string
  rate: number
  etd?: string
  estimated_delivery_days?: number
}

export type ShiprocketTrackingActivity = {
  date: string
  status?: string
  activity: string
  location?: string
}

export type ShiprocketTracking = {
  awb: string
  current_status: string
  delivered: boolean
  courier?: string
  etd?: string
  destination?: string
  activities: ShiprocketTrackingActivity[]
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

let pickupPincodeCache: string | null = null

/**
 * Origin pincode for serviceability checks. Uses SHIPROCKET_PICKUP_PINCODE when
 * set, otherwise resolves it once from the configured pickup location and caches it.
 */
export async function getPickupPincode(): Promise<string | null> {
  const fromEnv = process.env.SHIPROCKET_PICKUP_PINCODE?.trim()
  if (fromEnv) return fromEnv
  if (pickupPincodeCache) return pickupPincodeCache

  try {
    const response = await getShiprocketPickups()
    const data = (response as { data?: Record<string, unknown> })?.data
    const shipping = data?.shipping_address
    const entries: Array<Record<string, unknown>> = Array.isArray(shipping)
      ? shipping
      : shipping && typeof shipping === "object"
      ? [shipping as Record<string, unknown>]
      : []

    const wanted = (process.env.SHIPROCKET_PICKUP_LOCATION ?? "")
      .trim()
      .toLowerCase()
    const match =
      entries.find(
        (entry) =>
          String(entry.pickup_location ?? "").trim().toLowerCase() === wanted
      ) ?? entries[0]

    const pin = match?.pin_code ?? match?.pincode
    if (pin) {
      pickupPincodeCache = String(pin)
      return pickupPincodeCache
    }
  } catch (e) {
    console.warn("[shiprocket] Could not resolve pickup pincode", e)
  }

  return null
}

/** Couriers that can deliver to the given pincode from our pickup location. */
export async function checkShiprocketServiceability(
  deliveryPincode: string,
  weightKg?: number
): Promise<ShiprocketCourier[]> {
  const pickupPincode = await getPickupPincode()
  if (!pickupPincode) {
    throw new Error(
      "Shiprocket pickup pincode unavailable — set SHIPROCKET_PICKUP_PINCODE"
    )
  }

  const weight = weightKg ?? Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG ?? "0.35")
  const res = await shiprocketFetch(
    `/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&cod=0&weight=${weight}`
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Shiprocket serviceability failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    data?: { available_courier_companies?: Array<Record<string, unknown>> }
  }

  const couriers = data?.data?.available_courier_companies ?? []
  return couriers.map((c) => ({
    courier_company_id: Number(c.courier_company_id),
    courier_name: String(c.courier_name ?? ""),
    rate: Number(c.rate ?? 0),
    etd: c.etd ? String(c.etd) : undefined,
    estimated_delivery_days: c.estimated_delivery_days
      ? Number(c.estimated_delivery_days)
      : undefined,
  }))
}

/**
 * Choose a courier for the customer's shipping choice:
 * express → fastest ETA (ties broken by price), standard → cheapest (ties by ETA).
 */
export function pickCourierForMethod(
  couriers: ShiprocketCourier[],
  mode: "standard" | "express"
): ShiprocketCourier | undefined {
  if (!couriers.length) return undefined

  const byEta = (c: ShiprocketCourier) => c.estimated_delivery_days ?? 99

  const sorted = [...couriers].sort((a, b) =>
    mode === "express"
      ? byEta(a) - byEta(b) || a.rate - b.rate
      : a.rate - b.rate || byEta(a) - byEta(b)
  )
  return sorted[0]
}

/**
 * Assign an AWB (courier + tracking number) to a shipment. Omitting courierId
 * lets Shiprocket pick per your dashboard courier-priority settings.
 * NOTE: on a live account this books the shipment and charges your wallet.
 */
export async function assignShiprocketAwb(
  shipmentId: number,
  courierId?: number
): Promise<{ awb?: string; courier?: string }> {
  const res = await shiprocketFetch("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify({
      shipment_id: shipmentId,
      ...(courierId ? { courier_id: courierId } : {}),
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Shiprocket assign AWB failed (${res.status}): ${body}`)
  }

  const data = JSON.parse(body) as {
    response?: { data?: { awb_code?: string; courier_name?: string } }
  }

  return {
    awb: data.response?.data?.awb_code,
    courier: data.response?.data?.courier_name,
  }
}

/** Fabricated timeline for demo-mode AWBs so the tracking page can be tested end to end. */
function demoTracking(awb: string): ShiprocketTracking {
  const now = Date.now()
  const at = (hoursAgo: number) =>
    new Date(now - hoursAgo * 60 * 60 * 1000).toISOString()

  return {
    awb,
    current_status: "In Transit",
    delivered: false,
    courier: "Demo Courier",
    etd: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    destination: "Your city",
    activities: [
      {
        date: at(2),
        status: "IN TRANSIT",
        activity: "Shipment departed from hub",
        location: "Visakhapatnam Hub",
      },
      {
        date: at(20),
        status: "PICKED UP",
        activity: "Shipment picked up from seller",
        location: "Visakhapatnam",
      },
      {
        date: at(26),
        status: "AWB ASSIGNED",
        activity: "Shipment created and AWB assigned",
        location: "Visakhapatnam",
      },
    ],
  }
}

/**
 * Live tracking by AWB. Returns null when the AWB isn't known to Shiprocket yet
 * (couriers can take a few hours to activate tracking).
 */
export async function trackShiprocketAwb(
  awb: string
): Promise<ShiprocketTracking | null> {
  if (/^DEMO/i.test(awb)) {
    return demoTracking(awb)
  }

  const res = await shiprocketFetch(
    `/courier/track/awb/${encodeURIComponent(awb)}`
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Shiprocket tracking failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    tracking_data?: {
      error?: string
      track_status?: number
      shipment_status?: number
      etd?: string
      shipment_track?: Array<Record<string, unknown>>
      shipment_track_activities?: Array<Record<string, unknown>> | null
    }
  }

  const tracking = data.tracking_data
  if (!tracking || tracking.error) {
    return null
  }

  const summary = tracking.shipment_track?.[0] ?? {}
  const currentStatus = String(summary.current_status ?? "")
  if (!currentStatus && !tracking.shipment_track_activities?.length) {
    return null
  }

  return {
    awb,
    current_status: currentStatus || "Shipment created",
    delivered: /delivered/i.test(currentStatus),
    courier: summary.courier_name ? String(summary.courier_name) : undefined,
    etd: tracking.etd ? String(tracking.etd) : undefined,
    destination: summary.destination ? String(summary.destination) : undefined,
    activities: (tracking.shipment_track_activities ?? []).map((a) => ({
      date: String(a.date ?? ""),
      status: a["sr-status-label"]
        ? String(a["sr-status-label"])
        : a.status
        ? String(a.status)
        : undefined,
      activity: String(a.activity ?? ""),
      location: a.location ? String(a.location) : undefined,
    })),
  }
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
    comment: `Medusa order ${input.medusaOrderId}${
      input.shippingMethod ? ` · ${input.shippingMethod}` : ""
    }`,
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
    shipment_id: data.shipment_id,
    awb: data.awb_code,
  }
}
