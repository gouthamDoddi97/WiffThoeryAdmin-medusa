import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import {
  looksLikeInrPaiseShippingAmount,
  normalizeInrPaiseShippingToRupees,
  resolveCorrectOrderShippingInr,
  shiprocketRateToMedusaShippingAmount,
  splitTaxInclusiveAmount,
} from "../lib/currency/inr-amounts"

type ShippingOptionWithPrices = {
  id: string
  name?: string | null
  prices?: Array<{
    id?: string
    amount?: number
    currency_code?: string
    region_id?: string
  }>
}

type RawAmount = { value: string; precision: number }

function toRawAmount(value: number): RawAmount {
  return { value: String(value), precision: 20 }
}

function shippingAmountFromMethodData(
  data: Record<string, unknown> | null | undefined
): number | null {
  const rate = data?.shiprocket_rate_inr
  if (rate != null && Number.isFinite(Number(rate))) {
    return shiprocketRateToMedusaShippingAmount(Number(rate))
  }
  return null
}

/**
 * Fix INR shipping stored in paise-like units (9900 → ₹99) on shipping options,
 * carts, and placed orders. Also corrects payment collection amounts.
 *
 * Run: npx medusa exec ./src/scripts/fix-inr-shipping-amounts.ts
 * Dry run: DRY_RUN=true npx medusa exec ./src/scripts/fix-inr-shipping-amounts.ts
 * Single order: ORDER_DISPLAY_ID=17 npx medusa exec ./src/scripts/fix-inr-shipping-amounts.ts
 */
export default async function fixInrShippingAmounts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const dryRun = process.env.DRY_RUN === "true"
  const orderDisplayId = process.env.ORDER_DISPLAY_ID
    ? Number(process.env.ORDER_DISPLAY_ID)
    : undefined

  if (dryRun) {
    logger.warn("DRY RUN — no database writes")
  }

  // ── 1. Fix flat shipping option prices (9900 → 99) ──
  const standardInr = Math.round(Number(process.env.SHIPPING_STANDARD_INR ?? "99"))
  const expressInr = Math.round(Number(process.env.SHIPPING_EXPRESS_INR ?? "149"))

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "prices.id", "prices.amount", "prices.currency_code", "prices.region_id"],
  })

  const options = (shippingOptions ?? []) as ShippingOptionWithPrices[]

  const optionsToFix = options.filter((opt) => {
    const prices = opt.prices ?? []
    return prices.some((p) =>
      looksLikeInrPaiseShippingAmount(Number(p.amount ?? 0), 300)
    )
  })

  if (optionsToFix.length) {
    logger.info(
      `Fixing ${optionsToFix.length} shipping option price set(s) → Standard ₹${standardInr}, Express ₹${expressInr}`
    )

    if (!dryRun) {
      await updateShippingOptionsWorkflow(container).run({
        input: optionsToFix.map((option) => {
          const target = option.name?.toLowerCase().includes("express")
            ? expressInr
            : standardInr

          const prices = option.prices ?? []

          return {
            id: option.id,
            price_type: "flat" as const,
            prices: prices.map((p) =>
              p.region_id
                ? { region_id: p.region_id, amount: target }
                : { currency_code: p.currency_code ?? "inr", amount: target }
            ),
          }
        }),
      })
    }
  } else {
    logger.info("Shipping option prices already in rupees")
  }

  // ── 2. Fix placed orders with inflated shipping ──
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "currency_code",
      "item_total",
      "item_subtotal",
      "item_tax_total",
      "shipping_total",
      "shipping_subtotal",
      "shipping_tax_total",
      "tax_total",
      "total",
      "metadata",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.amount",
      "shipping_methods.data",
      "summary",
    ],
    pagination: { take: 50, order: { created_at: "DESC" } },
  })

  const candidates = (orders ?? []).filter((order) => {
    if (order.currency_code?.toLowerCase() !== "inr") {
      return false
    }
    if (orderDisplayId && Number(order.display_id) !== orderDisplayId) {
      return false
    }

    const itemTotal = Number(order.item_total ?? 0)
    const shippingTotal = Number(order.shipping_total ?? 0)
    const methods = order.shipping_methods as
      | Array<{ amount?: number }>
      | undefined

    return (
      looksLikeInrPaiseShippingAmount(shippingTotal, itemTotal) ||
      methods?.some((m) =>
        looksLikeInrPaiseShippingAmount(Number(m.amount ?? 0), itemTotal)
      )
    )
  })

  logger.info(`Found ${candidates.length} order(s) with inflated INR shipping`)

  for (const order of candidates) {
    const itemTotal = Number(order.item_total ?? 0)
    const itemSubtotal = Number(order.item_subtotal ?? 0)
    const itemTax = Number(order.item_tax_total ?? 0)
    const methods = (order.shipping_methods ?? []) as Array<{
      id: string
      name?: string
      amount?: number
      data?: Record<string, unknown>
    }>

    const method = methods[0]
    if (!method?.id) {
      logger.warn(`Order #${order.display_id}: no shipping method, skipping`)
      continue
    }

    const fromData = shippingAmountFromMethodData(method.data)
    const correctedShipping =
      fromData ??
      resolveCorrectOrderShippingInr({
        shippingAmount: Number(method.amount ?? order.shipping_total ?? 0),
        itemTotal,
        shippingMethodName: method.name,
        metadata: order.metadata as Record<string, unknown> | null,
      })

    const shippingParts = splitTaxInclusiveAmount(correctedShipping)
    const newShippingSubtotal = shippingParts.subtotal
    const newShippingTax = shippingParts.tax
    const newTaxTotal = Math.round((itemTax + newShippingTax) * 100) / 100
    const newTotal = Math.round((itemTotal + correctedShipping) * 100) / 100

    logger.info(
      `Order #${order.display_id}: shipping ${method.amount} → ${correctedShipping}, total ${order.total} → ${newTotal}`
    )

    if (dryRun) {
      continue
    }

    await pg("order_shipping_method")
      .where("id", method.id)
      .update({
        amount: correctedShipping,
        raw_amount: JSON.stringify(toRawAmount(correctedShipping)),
        updated_at: pg.fn.now(),
      })

    const taxLines = await pg("order_shipping_method_tax_line")
      .where("shipping_method_id", method.id)
      .select("id")

    for (const tl of taxLines) {
      await pg("order_shipping_method_tax_line")
        .where("id", tl.id)
        .update({
          updated_at: pg.fn.now(),
        })
    }

    const summaryRow = await pg("order_summary")
      .where("order_id", order.id)
      .whereNull("deleted_at")
      .orderBy("version", "desc")
      .first()

    if (summaryRow?.totals) {
      const totals =
        typeof summaryRow.totals === "string"
          ? JSON.parse(summaryRow.totals)
          : { ...summaryRow.totals }

      totals.current_order_total = newTotal
      totals.original_order_total = newTotal
      totals.accounting_total = newTotal
      totals.pending_difference = newTotal - Number(totals.paid_total ?? 0)
      totals.raw_current_order_total = toRawAmount(newTotal)
      totals.raw_original_order_total = toRawAmount(newTotal)
      totals.raw_accounting_total = toRawAmount(newTotal)
      totals.raw_pending_difference = toRawAmount(totals.pending_difference)

      await pg("order_summary")
        .where("id", summaryRow.id)
        .update({
          totals: JSON.stringify(totals),
          updated_at: pg.fn.now(),
        })
    }

    const paymentLinks = await pg("order_payment_collection").where(
      "order_id",
      order.id
    )

    for (const link of paymentLinks) {
      const pcId = link.payment_collection_id

      await pg("payment_collection")
        .where("id", pcId)
        .update({
          amount: newTotal,
          raw_amount: JSON.stringify(toRawAmount(newTotal)),
          authorized_amount: newTotal,
          raw_authorized_amount: JSON.stringify(toRawAmount(newTotal)),
          updated_at: pg.fn.now(),
        })

      await pg("payment_session")
        .where("payment_collection_id", pcId)
        .update({
          amount: newTotal,
          raw_amount: JSON.stringify(toRawAmount(newTotal)),
          updated_at: pg.fn.now(),
        })

      await pg("payment")
        .where("payment_collection_id", pcId)
        .update({
          amount: newTotal,
          raw_amount: JSON.stringify(toRawAmount(newTotal)),
          updated_at: pg.fn.now(),
        })
    }
  }

  logger.info("Done.")
}
