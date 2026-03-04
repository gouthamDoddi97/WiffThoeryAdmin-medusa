import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

const FRONTEND_URL = process.env.STOREFRONT_URL?.replace(/\/+$/, "");
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

export default async function categoryUpdatedHandler({
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  if (!FRONTEND_URL) {
    console.warn("Skipping revalidation because STOREFRONT_URL is not configured");
    return;
  }

  if (!REVALIDATE_SECRET) {
    console.warn("Skipping revalidation because REVALIDATE_SECRET is not configured");
    return;
  }

  const webhookUrl = `${FRONTEND_URL}/api/revalidate/categories`;
  console.log(`Product category ${data.id} changed, calling ${webhookUrl}`);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "x-revalidate-secret": REVALIDATE_SECRET,
      },
    });

    if (!response.ok) {
      const payload = await response.text();
      console.error(`Revalidation webhook failed (${response.status}): ${payload}`);
    } else {
      console.log("Revalidation webhook accepted");
    }
  } catch (error) {
    console.error("Failed to notify storefront about category update", error);
  }
}

export const config: SubscriberConfig = {
  event: [
    "product-category.created",
    "product-category.updated",
    "product-category.deleted",
  ],
};
