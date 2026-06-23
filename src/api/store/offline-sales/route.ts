import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  listOfflineSaleSetup,
  OfflineSaleBody,
  processOfflineSale,
  toErrorResponse,
} from "../../offline-sales/shared"

/** GET /store/offline-sales — list warehouses available for offline sales */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { stock_locations } = await listOfflineSaleSetup(req)
    res.json({ stock_locations })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function POST(
  req: MedusaRequest<OfflineSaleBody>,
  res: MedusaResponse
): Promise<void> {
  try {
    const result = await processOfflineSale(req, req.body)
    res.json(result)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
