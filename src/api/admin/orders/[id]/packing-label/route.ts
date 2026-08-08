import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildPackingLabelPdf } from "../../../../../lib/shipping-label/service"
import { generateShiprocketLabel } from "../../../../../lib/shiprocket/client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id
  const source = String(req.query.source ?? "internal")

  try {
    if (source === "shiprocket") {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "metadata"],
        filters: { id: orderId },
      })
      const shiprocket = (orders?.[0]?.metadata?.shiprocket ?? {}) as {
        shipment_id?: number
      }
      if (!shiprocket.shipment_id) {
        res.status(422).json({
          message:
            "No Shiprocket shipment yet. Wait for order sync or assign AWB in Shiprocket.",
        })
        return
      }

      const label = await generateShiprocketLabel(shiprocket.shipment_id)
      if (!label.label_url) {
        res.status(422).json({ message: label.message ?? "Label not available" })
        return
      }

      res.redirect(label.label_url)
      return
    }

    const { pdf, filename } = await buildPackingLabelPdf(req.scope, orderId)
    const disposition =
      req.query.disposition === "attachment" ? "attachment" : "inline"

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${filename}"`
    )
    res.send(pdf)
  } catch (e) {
    res.status(422).json({ message: (e as Error).message })
  }
}
