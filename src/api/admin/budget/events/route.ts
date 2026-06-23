import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ensureBudgetSetup, getBudgetService, toErrorResponse } from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as {
      name?: string
      event_date?: string
      location?: string
      notes?: string
    }

    if (!body.name) {
      res.status(400).json({ message: "name is required" })
      return
    }

    const [event] = await service.createBusinessEvents([
      {
        name: String(body.name),
        event_date: body.event_date ? new Date(body.event_date) : new Date(),
        location: body.location ?? null,
        notes: body.notes ?? null,
      },
    ])

    res.status(201).json({ event })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
