import {
  type SubscriberArgs,
  type SubscriberConfig,
} from "@medusajs/framework"

const FRONTEND_URL = process.env.STOREFRONT_URL?.replace(/\/+$/, "")
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET

export default async function inventoryChangeHandler({
  event: { name },
}: SubscriberArgs<{ id: string }>) {
  if (!FRONTEND_URL || !REVALIDATE_SECRET) {
    console.warn("Skipping inventory revalidation: STOREFRONT_URL or REVALIDATE_SECRET not set")
    return
  }

  console.log(`Inventory event "${name}", revalidating storefront products...`)

  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate/products`, {
      method: "POST",
      headers: { "x-revalidate-secret": REVALIDATE_SECRET },
    })
    if (!res.ok) {
      console.error(`Inventory revalidation failed (${res.status}): ${await res.text()}`)
    } else {
      console.log("Products cache revalidated after inventory change")
    }
  } catch (e) {
    console.error("Failed to revalidate after inventory change", e)
  }
}

export const config: SubscriberConfig = {
  event: [
    // Inventory item CRUD
    "inventory.inventory-item.created",
    "inventory.inventory-item.updated",
    "inventory.inventory-item.deleted",
    // Level changes — this is what changes when you update stock quantities
    "inventory.inventory-level.created",
    "inventory.inventory-level.updated",
    "inventory.inventory-level.deleted",
    // Reservations — affects available stock shown to customers
    "inventory.reservation-item.created",
    "inventory.reservation-item.updated",
    "inventory.reservation-item.deleted",
  ],
}
