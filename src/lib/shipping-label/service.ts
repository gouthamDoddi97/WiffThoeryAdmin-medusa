import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { loadOrderLabelData } from "./load-order-label-data"
import { generatePackingLabelPdf } from "./generate-packing-label-pdf"
import {
  getPackingLabelMeta,
  orderChannelBarcode,
} from "./metadata"

export async function buildPackingLabelPdf(
  container: MedusaContainer,
  orderId: string
): Promise<{ pdf: Buffer; filename: string }> {
  const data = await loadOrderLabelData(container, orderId)
  const pdf = await generatePackingLabelPdf(data)
  return {
    pdf,
    filename: `packing-label-${data.orderBarcode}.pdf`,
  }
}

export async function markPackingLabelReady(
  container: MedusaContainer,
  orderId: string
): Promise<void> {
  const data = await loadOrderLabelData(container, orderId)
  const orderModule = container.resolve(Modules.ORDER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })

  const existingMeta = (orders?.[0]?.metadata ?? {}) as Record<string, unknown>
  const previous = getPackingLabelMeta(existingMeta)

  await orderModule.updateOrders(orderId, {
    metadata: {
      ...existingMeta,
      packing_label: {
        ...previous,
        ready_at: new Date().toISOString(),
        order_barcode: data.orderBarcode,
        awb: data.awb,
        label_version: 1,
      },
    },
  })
}

export { orderChannelBarcode }
