import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, toErrorResponse } from "../../../../../budget/shared"

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await service.deleteFundingAllocations(req.params.id)
    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
