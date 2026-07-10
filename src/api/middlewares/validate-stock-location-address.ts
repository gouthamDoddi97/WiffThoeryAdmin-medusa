import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { validateStockLocationAddress } from "../../utils/stock-location-address"

type StockLocationBody = {
  address?: {
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    province?: string | null
    postal_code?: string | null
    country_code?: string | null
    phone?: string | null
  }
}

/** Enforce full warehouse address on create / update (Shiprocket + fulfillment). */
export async function requireStockLocationAddress(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = (req.validatedBody ?? req.body) as StockLocationBody
  const isCreate = !req.params?.id

  if (isCreate) {
    const error = validateStockLocationAddress(body.address)
    if (error) {
      res.status(400).json({ message: error, type: "invalid_data" })
      return
    }
  } else if (body.address !== undefined) {
    const error = validateStockLocationAddress(body.address)
    if (error) {
      res.status(400).json({ message: error, type: "invalid_data" })
      return
    }
  }

  next()
}
