import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { PRODUCT_REVIEWS_MODULE } from "../../../../../modules/product-reviews"

type ReviewBody = {
  author_name: string
  author_email?: string
  rating: number
  title?: string
  body: string
  image_urls?: string[]
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(PRODUCT_REVIEWS_MODULE) as any

  const reviews = await service.listProductReviews(
    { product_id: id, is_approved: true },
    { order: { created_at: "DESC" }, take: 100 }
  )

  const total = reviews.length
  const avg =
    total > 0
      ? Math.round((reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / total) * 10) / 10
      : null

  res.json({ reviews, stats: { total, average: avg } })
}

export async function POST(
  req: MedusaRequest<ReviewBody>,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const { author_name, author_email, rating, title, body, image_urls } = req.body

  if (!author_name?.trim() || !body?.trim()) {
    res.status(400).json({ error: "author_name and body are required" })
    return
  }

  const numRating = Number(rating)
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    res.status(400).json({ error: "rating must be an integer between 1 and 5" })
    return
  }

  // Sanitise lengths at the boundary
  const emailRaw = author_email?.trim() ?? ""
  const emailClean = emailRaw.length > 0 ? emailRaw.slice(0, 255) : null

  // Validate image_urls
  const cleanImageUrls =
    Array.isArray(image_urls)
      ? image_urls
          .filter((u) => typeof u === "string" && u.startsWith("http"))
          .slice(0, 5)
      : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(PRODUCT_REVIEWS_MODULE) as any

  const review = await service.createProductReviews({
    product_id: id,
    author_name: author_name.trim().slice(0, 100),
    author_email: emailClean,
    rating: numRating,
    title: title?.trim().slice(0, 200) || null,
    body: body.trim().slice(0, 2000),
    image_urls: cleanImageUrls,
    is_approved: false,
  })

  res.status(201).json({ review })
}
