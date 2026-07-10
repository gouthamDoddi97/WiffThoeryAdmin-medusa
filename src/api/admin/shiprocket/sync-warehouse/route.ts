import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { syncWarehouseToShiprocket } from "../../../../lib/shiprocket/sync-warehouse-pickup"

type Body = {
  stock_location_id?: string
}

export async function POST(
  req: MedusaRequest<Body>,
  res: MedusaResponse
): Promise<void> {
  try {
    const result = await syncWarehouseToShiprocket(
      req.scope,
      req.body?.stock_location_id
    )
    res.json(result)
  } catch (e) {
    res.status(422).json({ message: (e as Error).message })
  }
}
