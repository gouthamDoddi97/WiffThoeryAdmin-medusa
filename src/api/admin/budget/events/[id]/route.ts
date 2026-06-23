import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, toErrorResponse } from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as Record<string, unknown>
    const event = await service.updateBusinessEvents({
      id: req.params.id,
      ...body,
      ...(body.event_date ? { event_date: new Date(String(body.event_date)) } : {}),
    })
    res.json({ event })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await service.deleteBusinessEvents(req.params.id)
    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
