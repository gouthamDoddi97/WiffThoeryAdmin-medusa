import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { OFFERS_MODULE } from "../../../modules/offers"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = any

/** GET /admin/offers — list all sets (newest first) */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service: Service = req.scope.resolve(OFFERS_MODULE)
  const sets = await service.listFragranceSets({}, { order: { created_at: "DESC" } })
  res.json({ sets })
}

/** POST /admin/offers — create a new set */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service: Service = req.scope.resolve(OFFERS_MODULE)
  const { title, description, price_amount, currency_code, items, is_active, badge } =
    req.body as Record<string, unknown>

  if (!title || price_amount === undefined) {
    res.status(400).json({ error: "title and price_amount are required" })
    return
  }

  const set = await service.createFragranceSets({
    title,
    description: description ?? null,
    price_amount: Number(price_amount),
    currency_code: (currency_code as string) ?? "inr",
    items: (items as object[]) ?? [],
    is_active: is_active !== false,
    badge: badge ?? null,
  })
  res.status(201).json({ set })
}
