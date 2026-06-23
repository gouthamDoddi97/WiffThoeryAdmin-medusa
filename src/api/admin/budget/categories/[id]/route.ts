import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, slugify, toErrorResponse } from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as { name?: string; description?: string; sort_order?: number; is_active?: boolean }

    const category = await service.updateExpenseCategories({
      id: req.params.id,
      ...body,
      ...(body.name ? { slug: slugify(body.name) } : {}),
    })

    res.json({ category })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await service.deleteExpenseCategories(req.params.id)
    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
