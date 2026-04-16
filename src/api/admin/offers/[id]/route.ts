import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { OFFERS_MODULE } from "../../../../modules/offers"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = any

/** PATCH /admin/offers/:id — update a set */
export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service: Service = req.scope.resolve(OFFERS_MODULE)
  const { id } = req.params
  const body = req.body as Record<string, unknown>

  const set = await service.updateFragranceSets({ id, ...body })
  res.json({ set })
}

/** DELETE /admin/offers/:id — soft-delete a set */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service: Service = req.scope.resolve(OFFERS_MODULE)
  const { id } = req.params

  await service.deleteFragranceSets(id)
  res.json({ deleted: true })
}
