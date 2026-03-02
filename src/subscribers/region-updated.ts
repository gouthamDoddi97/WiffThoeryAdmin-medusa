import {
  type SubscriberArgs,
  type SubscriberConfig,
} from "@medusajs/framework"

const FRONTEND_URL = process.env.STOREFRONT_URL?.replace(/\/+$/, "")
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET

export default async function regionChangeHandler({
  event: { name },
}: SubscriberArgs<{ id: string }>) {
  if (!FRONTEND_URL || !REVALIDATE_SECRET) {
    console.warn("Skipping region revalidation: STOREFRONT_URL or REVALIDATE_SECRET not set")
    return
  }

  console.log(`Region event "${name}", revalidating storefront...`)

  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate/regions`, {
      method: "POST",
      headers: { "x-revalidate-secret": REVALIDATE_SECRET },
    })
    if (!res.ok) {
      console.error(`Region revalidation failed (${res.status}): ${await res.text()}`)
    } else {
      console.log("Region cache revalidated")
    }
  } catch (e) {
    console.error("Failed to revalidate region cache", e)
  }
}

export const config: SubscriberConfig = {
  event: [
    "region.created",
    "region.updated",
    "region.deleted",
  ],
}
