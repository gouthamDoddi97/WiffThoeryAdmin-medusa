import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShiprocketPickup,
  getShiprocketPickups,
  parseShiprocketPickupNicknames,
} from "../shiprocket/client"
import { isShiprocketConfigured } from "../integrations/config"
import {
  primaryShiprocketAddress,
  validateStockLocationAddress,
} from "../../utils/stock-location-address"

type StockLocationRow = {
  id: string
  name: string
  address?: {
    address_1?: string
    address_2?: string
    city?: string
    province?: string
    postal_code?: string
    country_code?: string
    phone?: string
  }
}

function countryName(code?: string) {
  if (!code) return "India"
  return code.toLowerCase() === "in" ? "India" : code.toUpperCase()
}

export type WarehouseSyncResult = {
  location_id: string
  location_name: string
  status: "already_synced" | "created" | "skipped"
  pickup_location?: string
  pickup_id?: number
  message: string
}

export async function syncWarehouseToShiprocket(
  container: MedusaContainer,
  stockLocationId?: string
): Promise<WarehouseSyncResult> {
  if (!isShiprocketConfigured()) {
    throw new Error(
      "Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_API_KEY in .env."
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const storeModule = container.resolve(Modules.STORE)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "address.address_1",
      "address.address_2",
      "address.city",
      "address.province",
      "address.postal_code",
      "address.country_code",
      "address.phone",
    ],
  })

  const rows = (locations ?? []) as StockLocationRow[]
  if (!rows.length) {
    throw new Error("No stock locations found. Add one in Settings → Locations.")
  }

  let location = stockLocationId
    ? rows.find((row) => row.id === stockLocationId)
    : undefined

  if (!location) {
    const [store] = await storeModule.listStores()
    location =
      rows.find((row) => row.id === store.default_location_id) ?? rows[0]
  }

  if (!location) {
    throw new Error(`Stock location not found: ${stockLocationId ?? "(default)"}`)
  }

  const addr = {
    ...(location.address ?? {}),
    phone:
      location.address?.phone ??
      process.env.SHIPROCKET_PICKUP_PHONE ??
      undefined,
  }

  const addressError = validateStockLocationAddress(addr)
  if (addressError) {
    throw new Error(`${location.name}: ${addressError}`)
  }

  const phone = addr.phone!.replace(/\D/g, "")
  const pickupNickname = (location.name || "Whiff Theory Warehouse").slice(0, 36)
  const contactEmail =
    process.env.SHIPROCKET_PICKUP_CONTACT_EMAIL ??
    process.env.SHIPROCKET_EMAIL ??
    process.env.SMTP_USER ??
    ""
  const contactName =
    process.env.SHIPROCKET_PICKUP_CONTACT_NAME ?? "Whiff Theory"

  if (!contactEmail) {
    throw new Error(
      "Set SHIPROCKET_PICKUP_CONTACT_EMAIL or SHIPROCKET_EMAIL in .env"
    )
  }

  try {
    const existing = await getShiprocketPickups()
    const syncedNicknames = parseShiprocketPickupNicknames(existing)
    const match = [...syncedNicknames].find(
      (name) => name === pickupNickname.toLowerCase()
    )

    if (match) {
      return {
        location_id: location.id,
        location_name: location.name,
        status: "already_synced",
        pickup_location: pickupNickname,
        message: `Pickup "${pickupNickname}" already exists in Shiprocket.`,
      }
    }
  } catch {
    // continue to create
  }

  const result = await createShiprocketPickup({
    pickup_location: pickupNickname,
    name: contactName,
    email: contactEmail,
    phone,
    address: primaryShiprocketAddress(addr),
    address_2: addr.address_2 ?? "",
    city: addr.city!,
    state: addr.province!,
    country: countryName(addr.country_code),
    pin_code: addr.postal_code!,
  })

  return {
    location_id: location.id,
    location_name: location.name,
    status: "created",
    pickup_location: result.pickup_location,
    pickup_id: result.pickup_id,
    message: `Shiprocket pickup created: "${result.pickup_location}"`,
  }
}

export type WarehouseAlert = {
  location_id: string
  location_name: string
  issue: "invalid_address" | "not_synced"
  message: string
}

export async function getWarehouseAlerts(
  container: MedusaContainer
): Promise<WarehouseAlert[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "address.address_1",
      "address.address_2",
      "address.city",
      "address.province",
      "address.postal_code",
      "address.country_code",
      "address.phone",
    ],
  })

  const rows = (locations ?? []) as StockLocationRow[]
  const alerts: WarehouseAlert[] = []

  let syncedNicknames = new Set<string>()
  const configuredPickup = process.env.SHIPROCKET_PICKUP_LOCATION?.trim()
  if (configuredPickup) {
    syncedNicknames.add(configuredPickup.toLowerCase())
  }

  if (isShiprocketConfigured()) {
    try {
      const existing = await getShiprocketPickups()
      syncedNicknames = new Set([
        ...syncedNicknames,
        ...parseShiprocketPickupNicknames(existing),
      ])
    } catch {
      // treat valid addresses as needing sync only if we can't list pickups
    }
  }

  for (const location of rows) {
    const addr = {
      ...(location.address ?? {}),
      phone:
        location.address?.phone ??
        process.env.SHIPROCKET_PICKUP_PHONE ??
        undefined,
    }

    const addressError = validateStockLocationAddress(addr)
    if (addressError) {
      alerts.push({
        location_id: location.id,
        location_name: location.name,
        issue: "invalid_address",
        message: addressError,
      })
      continue
    }

    if (!isShiprocketConfigured()) continue

    const nickname = (location.name || "Whiff Theory Warehouse")
      .slice(0, 36)
      .toLowerCase()

    if (!syncedNicknames.has(nickname)) {
      alerts.push({
        location_id: location.id,
        location_name: location.name,
        issue: "not_synced",
        message: `Warehouse "${location.name}" is not synced to Shiprocket yet.`,
      })
    }
  }

  return alerts
}
