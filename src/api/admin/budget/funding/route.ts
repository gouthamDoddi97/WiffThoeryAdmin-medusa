import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ensureBudgetSetup, getBudgetService, toErrorResponse } from "../../../budget/shared"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await ensureBudgetSetup(req)
    const body = req.body as Record<string, unknown>

    if (!body.type || !body.label) {
      res.status(400).json({ message: "type and label are required" })
      return
    }

    const [source] = await service.createFundingSources([
      {
        type: String(body.type),
        label: String(body.label),
        founder_key: body.founder_key ? String(body.founder_key) : null,
        principal_amount: body.principal_amount != null ? Number(body.principal_amount) : null,
        interest_rate: body.interest_rate != null ? Number(body.interest_rate) : null,
        tenure_months: body.tenure_months != null ? Number(body.tenure_months) : null,
        emi_amount: body.emi_amount != null ? Number(body.emi_amount) : null,
        disbursement_date: body.disbursement_date
          ? new Date(String(body.disbursement_date))
          : null,
        maturity_date: body.maturity_date ? new Date(String(body.maturity_date)) : null,
        status: String(body.status ?? "active"),
        notes: body.notes ? String(body.notes) : null,
        use_of_funds_notes: body.use_of_funds_notes ? String(body.use_of_funds_notes) : null,
      },
    ])

    res.status(201).json({ funding_source: source })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
