/** Cart line shape from Medusa graph (cart or order). */
export type ShiprocketWeightLine = {
  quantity?: number | string | null
  variant?: { weight?: number | string | null } | null
  product?: { weight?: number | string | null } | null
  metadata?: Record<string, unknown> | null
}

function defaultLineWeightKg(): number {
  return Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG ?? "0.35")
}

function minCartWeightKg(): number {
  return Number(process.env.SHIPROCKET_MIN_WEIGHT_KG ?? "0.2")
}

/** Medusa stores product/variant weight in grams. */
function lineWeightKg(line: ShiprocketWeightLine): number {
  const quantity = Math.max(1, Number(line.quantity ?? 1))
  const metaGrams = line.metadata?.shipping_weight_grams
  const grams = Number(
    line.variant?.weight ??
      line.product?.weight ??
      (metaGrams != null ? metaGrams : NaN)
  )

  const perUnitKg = Number.isFinite(grams) && grams > 0
    ? grams / 1000
    : defaultLineWeightKg()

  return perUnitKg * quantity
}

/** Sum line weights for Shiprocket serviceability (min 0.2 kg). */
export function computeCartWeightKg(
  lines: ShiprocketWeightLine[] | null | undefined
): number {
  if (!lines?.length) {
    return Math.max(minCartWeightKg(), defaultLineWeightKg())
  }

  const total = lines.reduce((sum, line) => sum + lineWeightKg(line), 0)
  return Math.max(minCartWeightKg(), Math.round(total * 1000) / 1000)
}

/** Fallback when only item count is known (no variant weights loaded). */
export function estimateCartWeightKg(itemCount: number): number {
  const perItem = defaultLineWeightKg()
  const base = minCartWeightKg()
  return Math.max(base, perItem * Math.max(1, itemCount))
}
