import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { PRODUCT_REVIEWS_MODULE } from "../../../../modules/product-reviews"

export async function PATCH(
  req: MedusaRequest<{ is_approved: boolean }>,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(PRODUCT_REVIEWS_MODULE) as any

  const review = await service.updateProductReviews({
    id,
    is_approved: req.body.is_approved,
  })

  res.json({ review })
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(PRODUCT_REVIEWS_MODULE) as any

  await service.deleteProductReviews(id)

  res.json({ deleted: true, id })
}
