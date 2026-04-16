import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { OFFERS_MODULE } from "../../../../modules/offers"

/** GET /store/offers/:id — single active set for the detail page */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(OFFERS_MODULE) as any
  const { id } = req.params

  const [set] = await service.listFragranceSets({ id, is_active: true }, { take: 1 })

  if (!set) {
    res.status(404).json({ error: "Not found" })
    return
  }

  res.json({ set })
}
