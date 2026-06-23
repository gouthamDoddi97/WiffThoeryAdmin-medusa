import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  deleteOfflineSale,
  getOfflineSale,
  OfflineSaleBody,
  toErrorResponse,
  updateOfflineSale,
} from "../../../offline-sales/shared"

/** GET /admin/offline-sales/:id */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const order = await getOfflineSale(req, req.params.id)
    res.json({ order })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

/** PATCH /admin/offline-sales/:id */
export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const result = await updateOfflineSale(
      req,
      req.params.id,
      req.body as OfflineSaleBody
    )
    res.json(result)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

/** DELETE /admin/offline-sales/:id */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const result = await deleteOfflineSale(req, req.params.id)
    res.json(result)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
