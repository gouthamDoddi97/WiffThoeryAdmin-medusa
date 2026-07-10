import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShiprocketPickup,
  getShiprocketPickups,
  parseShiprocketPickupNicknames,
} from "../lib/shiprocket/client"
import { isShiprocketConfigured } from "../lib/integrations/config"
import {
  primaryShiprocketAddress,
  validateStockLocationAddress,
} from "../utils/stock-location-address"

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
  if (!code) {
    return "India"
  }
  return code.toLowerCase() === "in" ? "India" : code.toUpperCase()
}

/**
 * Creates a Shiprocket pickup location from a Medusa stock location (warehouse).
 * Medusa Admin → Settings → Locations is the source of truth for the address.
 *
 * Run: npx medusa exec ./src/scripts/sync-shiprocket-pickup.ts [stock_location_id]
 */
export default async function syncShiprocketPickup({
  container,
  args,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const storeModule = container.resolve(Modules.STORE)

  if (!isShiprocketConfigured()) {
    logger.error(
      "Set SHIPROCKET_EMAIL + SHIPROCKET_API_KEY in whiff-theory/.env first."
    )
    return
  }

  const stockLocationId = args?.[0] as string | undefined

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
    logger.error("No stock locations in Medusa. Add one in Admin → Settings → Locations.")
    return
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
    logger.error(`Stock location not found: ${stockLocationId ?? "(default)"}`)
    return
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
    logger.error(`Stock location "${location.name}": ${addressError}`)
    logger.error(
      "Update it in Medusa Admin → Settings → Locations (all fields required on save)."
    )
    return
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
    logger.error("Set SHIPROCKET_PICKUP_CONTACT_EMAIL or SHIPROCKET_EMAIL in .env")
    return
  }

  logger.info(`Syncing Medusa warehouse "${location.name}" → Shiprocket pickup…`)

  try {
    const existing = await getShiprocketPickups()
    const syncedNicknames = parseShiprocketPickupNicknames(existing)

    if (syncedNicknames.has(pickupNickname.toLowerCase())) {
      logger.info(
        `Pickup "${pickupNickname}" already exists in Shiprocket.`
      )
      logger.info(`Set in .env: SHIPROCKET_PICKUP_LOCATION=${pickupNickname}`)
      return
    }
  } catch (e) {
    logger.warn(`Could not list existing pickups: ${(e as Error).message}`)
  }

  try {
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

    logger.info(`✓ Shiprocket pickup created: "${result.pickup_location}"`)
    if (result.pickup_id) {
      logger.info(`  pickup_id: ${result.pickup_id}`)
    }
    if (result.pickup_code) {
      logger.info(`  pickup_code: ${result.pickup_code}`)
    }
    logger.info(`Add to whiff-theory/.env:`)
    logger.info(`SHIPROCKET_PICKUP_LOCATION=${result.pickup_location}`)
  } catch (e) {
    logger.error((e as Error).message)
    logger.warn(
      "Shiprocket requires address line 1 to include a house/flat/road number, and a valid 10-digit phone."
    )
  }
}
