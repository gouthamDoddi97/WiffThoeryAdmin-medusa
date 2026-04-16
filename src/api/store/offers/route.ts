import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { OFFERS_MODULE } from "../../../modules/offers"

/** GET /store/offers — returns all active fragrance sets */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(OFFERS_MODULE) as any

  const sets = await service.listFragranceSets(
    { is_active: true },
    { order: { created_at: "ASC" } }
  )

  res.json({ sets })
}
