import {
  type SubscriberArgs,
  type SubscriberConfig,
} from "@medusajs/framework"

const FRONTEND_URL = process.env.STOREFRONT_URL?.replace(/\/+$/, "")
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET

export default async function productChangeHandler({
  event: { data, name },
}: SubscriberArgs<{ id: string }>) {
  if (!FRONTEND_URL || !REVALIDATE_SECRET) {
    console.warn("Skipping product revalidation: STOREFRONT_URL or REVALIDATE_SECRET not set")
    return
  }

  console.log(`Product event "${name}" for ${data.id}, revalidating storefront...`)

  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate/products`, {
      method: "POST",
      headers: { "x-revalidate-secret": REVALIDATE_SECRET },
    })
    if (!res.ok) {
      console.error(`Product revalidation failed (${res.status}): ${await res.text()}`)
    } else {
      console.log("Product cache revalidated")
    }
  } catch (e) {
    console.error("Failed to revalidate product cache", e)
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product.deleted",
  ],
}
