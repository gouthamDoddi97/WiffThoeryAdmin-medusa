import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  isPackingLabelReady,
  shouldRequirePackingLabel,
} from "../../lib/shipping-label/metadata"

export async function requirePackingLabelBeforeFulfillment(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const orderId = req.params.id
  if (!orderId) {
    return next()
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })

    const order = orders?.[0] as
      | { metadata?: Record<string, unknown> | null }
      | undefined

    if (!order || !shouldRequirePackingLabel(order.metadata)) {
      return next()
    }

    if (isPackingLabelReady(order.metadata)) {
      return next()
    }

    res.status(422).json({
      message:
        "Print the packing label and confirm it is on the box before creating fulfillment. Open the Packing Label panel on this order.",
      code: "packing_label_required",
    })
  } catch {
    return next()
  }
}
