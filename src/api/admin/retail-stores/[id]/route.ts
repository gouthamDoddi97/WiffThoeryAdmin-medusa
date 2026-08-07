import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  deleteRetailStore,
  getStoreInventory,
  toErrorResponse,
  updateRetailStore,
} from "../../../retail-stores/shared"

/** GET /admin/retail-stores/:id — store details with on-shelf inventory */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const inventory = await getStoreInventory(req, req.params.id)
    res.json(inventory)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

/** PATCH /admin/retail-stores/:id — update store name/location/status */
export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const store = await updateRetailStore(req, req.params.id, req.body as any)
    res.json({ store })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

/** DELETE /admin/retail-stores/:id — soft-delete store record */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const result = await deleteRetailStore(req, req.params.id)
    res.json(result)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
