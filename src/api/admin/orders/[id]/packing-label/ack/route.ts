import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { markPackingLabelReady } from "../../../../../../lib/shipping-label/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    await markPackingLabelReady(req.scope, req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(422).json({ message: (e as Error).message })
  }
}
