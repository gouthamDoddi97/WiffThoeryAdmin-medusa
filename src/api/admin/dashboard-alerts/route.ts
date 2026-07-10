import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { getDashboardAlerts } from "../../../lib/fragrance-notes/alerts"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const alerts = await getDashboardAlerts(req.scope)
  res.json(alerts)
}
