import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * One-time setup: India service zone + flat-rate shipping options (INR).
 * Shiprocket creates the actual shipment after order.placed — this unblocks checkout.
 *
 * Run: npx medusa exec ./src/scripts/setup-india-shipping.ts
 */
export default async function setupIndiaShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const storeModule = container.resolve(Modules.STORE)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })

  type RegionRow = {
    id: string
    currency_code?: string | null
    countries?: Array<{ iso_2?: string | null } | null> | null
  }

  const indiaRegion = (regions as RegionRow[] | undefined)?.find(
    (region) =>
      region.currency_code?.toLowerCase() === "inr" ||
      region.countries?.some((c) => c?.iso_2?.toLowerCase() === "in")
  )

  if (!indiaRegion) {
    logger.error(
      "No India/INR region found. Create one in Admin → Settings → Regions (country: IN, currency: INR) and run again."
    )
    return
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })

  const stockLocation = locations?.[0] as { id: string; name?: string } | undefined
  if (!stockLocation) {
    logger.error("No stock location found. Add one in Admin → Settings → Locations.")
    return
  }

  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    })
  } catch {
    // already linked
  }

  try {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "in", provider_id: "tp_system" }],
    })
  } catch {
    // may already exist
  }

  const fulfillmentSets = await fulfillmentModule.listFulfillmentSets(
    {},
    { relations: ["service_zones", "service_zones.geo_zones"] }
  )

  let serviceZoneId: string | null = null

  for (const set of fulfillmentSets) {
    for (const zone of set.service_zones ?? []) {
      const coversIndia = zone.geo_zones?.some(
        (gz) => gz.country_code?.toLowerCase() === "in"
      )
      if (coversIndia) {
        serviceZoneId = zone.id
        break
      }
    }
    if (serviceZoneId) {
      break
    }
  }

  if (!serviceZoneId) {
    const fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
      name: "India delivery",
      type: "shipping",
      service_zones: [
        {
          name: "India",
          geo_zones: [{ country_code: "in", type: "country" }],
        },
      ],
    })

    serviceZoneId = fulfillmentSet.service_zones[0].id

    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    })

    logger.info(`Created India fulfillment set (${fulfillmentSet.id})`)
  } else {
    logger.info(`Using existing India service zone: ${serviceZoneId}`)
  }

  const [store] = await storeModule.listStores()
  const salesChannelId = store.default_sales_channel_id

  if (salesChannelId) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: salesChannelId, add: [stockLocation.id] },
      })
    } catch {
      // already linked
    }
  }

  const shippingProfiles = await fulfillmentModule.listShippingProfiles({
    type: "default",
  })
  const shippingProfile = shippingProfiles[0]

  if (!shippingProfile) {
    logger.error("No default shipping profile found.")
    return
  }

  const existingOptions = await fulfillmentModule.listShippingOptions({
    service_zone: { id: serviceZoneId },
  })

  if (existingOptions.length > 0) {
    const standardInr = Math.round(
      Number(process.env.SHIPPING_STANDARD_INR ?? "99")
    )
    const expressInr = Math.round(
      Number(process.env.SHIPPING_EXPRESS_INR ?? "149")
    )

    await updateShippingOptionsWorkflow(container).run({
      input: existingOptions.map((option) => {
        const target = option.name?.toLowerCase().includes("express")
          ? expressInr
          : standardInr

        return {
          id: option.id,
          price_type: "flat" as const,
          prices: [
            { currency_code: "inr", amount: target },
            { region_id: indiaRegion.id, amount: target },
          ],
        }
      }),
    })

    logger.info(
      `Updated India shipping prices (Standard ₹${standardInr}, Express ₹${expressInr})`
    )
    logger.info(
      `India shipping already configured (${existingOptions.length} option(s): ${existingOptions.map((o) => o.name).join(", ")})`
    )
    return
  }

  const standardInr = Math.round(Number(process.env.SHIPPING_STANDARD_INR ?? "99"))
  const expressInr = Math.round(Number(process.env.SHIPPING_EXPRESS_INR ?? "149"))

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Delivered in 3–5 business days via Shiprocket.",
          code: "standard",
        },
        prices: [
          { currency_code: "inr", amount: standardInr },
          { region_id: indiaRegion.id, amount: standardInr },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Priority delivery in 1–2 business days via Shiprocket.",
          code: "express",
        },
        prices: [
          { currency_code: "inr", amount: expressInr },
          { region_id: indiaRegion.id, amount: expressInr },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  logger.info(
    `India shipping options created (Standard ₹${standardInr / 100}, Express ₹${expressInr / 100}). Restart storefront checkout and select a method.`
  )
}
