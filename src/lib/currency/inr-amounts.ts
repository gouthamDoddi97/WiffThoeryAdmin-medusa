/** GST rate applied to India storefront orders (tax-inclusive pricing). */
export const INR_GST_RATE = 0.18

/**
 * Medusa stores INR product prices in rupees (300 = ₹300).
 * Legacy shipping was incorrectly stored in paise-like units (9900 = ₹99).
 */
export function looksLikeInrPaiseShippingAmount(
  shippingAmount: number,
  itemTotal: number
): boolean {
  if (shippingAmount <= 0) {
    return false
  }

  const asRupees = shippingAmount / 100

  if (itemTotal > 0 && shippingAmount >= itemTotal * 10) {
    return true
  }

  return (
    shippingAmount >= 1000 &&
    shippingAmount % 100 === 0 &&
    asRupees >= 10 &&
    asRupees <= 2500
  )
}

export function normalizeInrPaiseShippingToRupees(
  shippingAmount: number,
  itemTotal: number
): number {
  if (!looksLikeInrPaiseShippingAmount(shippingAmount, itemTotal)) {
    return shippingAmount
  }

  return shippingAmount / 100
}

/** Shiprocket API rates are already in INR rupees — store as-is in Medusa. */
export function shiprocketRateToMedusaShippingAmount(rateInr: number): number {
  return Math.round(rateInr * 100) / 100
}

export function splitTaxInclusiveAmount(total: number): {
  subtotal: number
  tax: number
} {
  const subtotal = total / (1 + INR_GST_RATE)
  const tax = total - subtotal
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
  }
}

export function resolveCorrectOrderShippingInr(input: {
  shippingAmount: number
  itemTotal: number
  shippingMethodName?: string | null
  metadata?: Record<string, unknown> | null
}): number {
  const shiprocket = input.metadata?.shiprocket as
    | { rate_inr?: number }
    | undefined

  if (
    shiprocket?.rate_inr != null &&
    Number.isFinite(shiprocket.rate_inr) &&
    /shiprocket/i.test(input.shippingMethodName ?? "")
  ) {
    return shiprocketRateToMedusaShippingAmount(shiprocket.rate_inr)
  }

  return normalizeInrPaiseShippingToRupees(
    input.shippingAmount,
    input.itemTotal
  )
}
