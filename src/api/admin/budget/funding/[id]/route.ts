import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getBudgetService, toErrorResponse } from "../../../../budget/shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    const body = req.body as Record<string, unknown>

    const funding_source = await service.updateFundingSources({
      id: req.params.id,
      ...body,
      ...(body.principal_amount != null ? { principal_amount: Number(body.principal_amount) } : {}),
      ...(body.interest_rate != null ? { interest_rate: Number(body.interest_rate) } : {}),
      ...(body.tenure_months != null ? { tenure_months: Number(body.tenure_months) } : {}),
      ...(body.emi_amount != null ? { emi_amount: Number(body.emi_amount) } : {}),
      ...(body.disbursement_date
        ? { disbursement_date: new Date(String(body.disbursement_date)) }
        : {}),
      ...(body.maturity_date ? { maturity_date: new Date(String(body.maturity_date)) } : {}),
    })

    res.json({ funding_source })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = getBudgetService(req)
    await service.deleteFundingSources(req.params.id)
    res.json({ deleted: true, id: req.params.id })
  } catch (error) {
    const { status, message } = toErrorResponse(error)
    res.status(status).json({ message })
  }
}
