import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  listOfflineSaleSetup,
  listOfflineSales,
  OfflineSaleBody,
  processOfflineSale,
  toErrorResponse,
} from "../../offline-sales/shared"

/** GET /admin/offline-sales — list sales and form setup data */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const sales = await listOfflineSales(req)
    const setup = await listOfflineSaleSetup(req, sales)

    res.json({ sales, ...setup })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

/** POST /admin/offline-sales — record an offline sale and adjust inventory */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const result = await processOfflineSale(req, req.body as OfflineSaleBody)
    res.status(201).json(result)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
