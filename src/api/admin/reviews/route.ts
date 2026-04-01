import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(PRODUCT_REVIEWS_MODULE) as any

  const status = (req.query.status as string) ?? "all"
  const filter: Record<string, unknown> = {}
  if (status === "pending") filter.is_approved = false
  if (status === "approved") filter.is_approved = true

  const reviews = await service.listProductReviews(filter, {
    order: { created_at: "DESC" },
    take: 200,
  })

  res.json({ reviews })
}
