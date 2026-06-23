import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ensureBudgetSetup, getBudgetService, slugify, toErrorResponse } from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as { name?: string; description?: string; sort_order?: number }

    if (!body.name?.trim()) {
      res.status(400).json({ message: "name is required" })
      return
    }

    const [category] = await service.createExpenseCategories([
      {
        name: body.name.trim(),
        slug: slugify(body.name),
        description: body.description ?? null,
        sort_order: Number(body.sort_order ?? 99),
        is_active: true,
      },
    ])

    res.status(201).json({ category })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
