import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  createRetailStore,
  listRetailStoreRecords,
  listWarehouseStockLocations,
  toErrorResponse,
} from "../../retail-stores/shared"

/** GET /admin/retail-stores — list retail stores and warehouse options */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const [stores, warehouses] = await Promise.all([
      listRetailStoreRecords(req),
      listWarehouseStockLocations(req),
    ])

    res.json({ stores, warehouses })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

/** POST /admin/retail-stores — create a retail store with its own shelf stock location */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const result = await createRetailStore(req, req.body as any)
    res.status(201).json(result)
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
