import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { toErrorResponse, transferStockToStore } from "../../../../retail-stores/shared"

/** POST /admin/retail-stores/:id/transfer — move stock from warehouse to store shelf */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const result = await transferStockToStore(req, req.params.id, req.body as any)
    res.status(201).json(result)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
