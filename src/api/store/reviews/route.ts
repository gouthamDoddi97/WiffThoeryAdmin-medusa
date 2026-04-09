import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"

/**
 * GET /store/reviews
 * Returns a sample of approved reviews across all products, for the home page.
 * Query params: limit (default 8), with_images (default false)
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const limit = Math.min(Number(req.query.limit ?? 8), 20)
  const withImages = req.query.with_images === "true"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(PRODUCT_REVIEWS_MODULE) as any

  const filter: Record<string, unknown> = { is_approved: true }
  if (withImages) {
    // Only fetch reviews that have image_urls (non-null / non-empty)
    // We'll filter in-process since Mikro-ORM JSON array filtering is complex
  }

  const allReviews = await service.listProductReviews(filter, {
    order: { created_at: "DESC" },
    take: 100,
  })

  let pool: unknown[] = allReviews

  if (withImages) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pool = allReviews.filter((r: any) => Array.isArray(r.image_urls) && r.image_urls.length > 0)
  }

  // Shuffle and take a sample so home page feels varied on each server render
  const shuffled = pool
    .map((r) => ({ r, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ r }) => r)

  res.json({ reviews: shuffled.slice(0, limit) })
}
