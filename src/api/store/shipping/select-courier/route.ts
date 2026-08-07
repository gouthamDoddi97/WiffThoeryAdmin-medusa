import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { isShiprocketConfigured } from "../../../../lib/integrations/config"
import { selectShiprocketCourierForCart } from "../../../../lib/shiprocket/cart-shipping"

type SelectCourierBody = {
  cart_id?: string
  courier_company_id?: number
  pincode?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as SelectCourierBody
  const cartId = String(body.cart_id ?? "").trim()
  const courierCompanyId = Number(body.courier_company_id)
  const pincode = String(body.pincode ?? "").trim()

  if (!cartId) {
    res.status(400).json({ error: "cart_id is required" })
    return
  }

  if (!Number.isFinite(courierCompanyId)) {
    res.status(400).json({ error: "courier_company_id is required" })
    return
  }

  if (!isShiprocketConfigured()) {
    res.status(503).json({ error: "Shiprocket is not configured" })
    return
  }

  try {
    const result = await selectShiprocketCourierForCart(req.scope, {
      cartId,
      courierCompanyId,
      pincode,
    })

    res.json({
      ok: true,
      cart_id: result.cart_id,
      courier: result.courier,
    })
  } catch (e) {
    console.warn("[shipping/select-courier] Failed", e)
    res.status(400).json({
      error: e instanceof Error ? e.message : "Could not select courier",
    })
  }
}
