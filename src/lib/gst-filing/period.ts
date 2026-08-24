/** Month boundaries in IST (UTC+5:30) for order / expense filtering. */
export function monthRangeUtc(year: number, month: number): {
  start: Date
  end: Date
} {
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const startIst = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const endIst = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return {
    start: new Date(startIst.getTime() - istOffsetMs),
    end: new Date(endIst.getTime() - istOffsetMs),
  }
}

export function isOfflineSaleOrder(
  metadata?: Record<string, unknown> | null
): boolean {
  return metadata?.offline_sale === true || metadata?.offline_sale === "true"
}
