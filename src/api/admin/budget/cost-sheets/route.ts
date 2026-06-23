import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ensureBudgetSetup, getBudgetService, toErrorResponse } from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as Record<string, unknown>

    if (!body.name) {
      res.status(400).json({ message: "name is required" })
      return
    }

    const [cost_sheet] = await service.createProductCostSheets([
      {
        name: String(body.name),
        product_id: body.product_id ? String(body.product_id) : null,
        variant_id: body.variant_id ? String(body.variant_id) : null,
        line_type: String(body.line_type ?? "core"),
        fragrance_cost: Number(body.fragrance_cost ?? 0),
        alcohol_cost: Number(body.alcohol_cost ?? 0),
        bottle_cost: Number(body.bottle_cost ?? 0),
        cap_cost: Number(body.cap_cost ?? 0),
        label_cost: Number(body.label_cost ?? 0),
        box_cost: Number(body.box_cost ?? 0),
        filling_cost: Number(body.filling_cost ?? 0),
        packaging_other: Number(body.packaging_other ?? 0),
        batch_quantity: Number(body.batch_quantity ?? 0),
        units_sold: Number(body.units_sold ?? 0),
        retail_price: Number(body.retail_price ?? 0),
        avg_discount_percent: Number(body.avg_discount_percent ?? 0),
        notes: body.notes ? String(body.notes) : null,
      },
    ])

    res.status(201).json({ cost_sheet })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
