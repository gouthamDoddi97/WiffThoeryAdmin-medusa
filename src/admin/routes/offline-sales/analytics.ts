export type SaleLike = {
  id: string
  display_id: number
  currency_code: string
  created_at: string
  canceled_at?: string | null
  metadata?: {
    customer_name?: string
    customer_phone?: string
    seller_name?: string
    payment_method?: string
    paid_amount?: number
    discount_applied?: number
    original_total?: number
  }
}

export type ChartDatum = {
  label: string
  value: number
  count?: number
}

export type RepeatCustomerRow = {
  name: string
  phone: string
  visits: number
  revenue: number
}

export type OfflineSaleStats = {
  currencyCode: string
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  totalDiscount: number
  uniqueCustomers: number
  repeatCustomers: number
  repeatRate: number
  salesBySeller: ChartDatum[]
  salesByPayment: ChartDatum[]
  dailySales: ChartDatum[]
  topRepeatCustomers: RepeatCustomerRow[]
  visitDistribution: ChartDatum[]
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone?.trim()) {
    return null
  }

  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) {
    return null
  }

  return digits.slice(-10)
}

function paidAmount(sale: SaleLike): number {
  return Number(sale.metadata?.paid_amount ?? 0)
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatDayLabel(key: string): string {
  const date = new Date(`${key}T12:00:00`)
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(
    date
  )
}

export function computeOfflineSaleStats(sales: SaleLike[]): OfflineSaleStats {
  const active = sales.filter((sale) => !sale.canceled_at)
  const currencyCode = active[0]?.currency_code ?? "inr"

  const totalRevenue = active.reduce((sum, sale) => sum + paidAmount(sale), 0)
  const totalDiscount = active.reduce(
    (sum, sale) => sum + Number(sale.metadata?.discount_applied ?? 0),
    0
  )
  const totalOrders = active.length
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  const sellerMap = new Map<string, { value: number; count: number }>()
  const paymentMap = new Map<string, { value: number; count: number }>()
  const dailyMap = new Map<string, { value: number; count: number }>()
  const phoneMap = new Map<
    string,
    { name: string; phone: string; visits: number; revenue: number }
  >()

  for (const sale of active) {
    const amount = paidAmount(sale)
    const seller = sale.metadata?.seller_name?.trim() || "Unknown"
    const payment = sale.metadata?.payment_method ?? "other"
    const paymentLabel = PAYMENT_LABELS[payment] ?? payment

    const sellerEntry = sellerMap.get(seller) ?? { value: 0, count: 0 }
    sellerEntry.value += amount
    sellerEntry.count += 1
    sellerMap.set(seller, sellerEntry)

    const paymentEntry = paymentMap.get(paymentLabel) ?? { value: 0, count: 0 }
    paymentEntry.value += amount
    paymentEntry.count += 1
    paymentMap.set(paymentLabel, paymentEntry)

    const created = new Date(sale.created_at)
    const key = dayKey(created)
    const dailyEntry = dailyMap.get(key) ?? { value: 0, count: 0 }
    dailyEntry.value += amount
    dailyEntry.count += 1
    dailyMap.set(key, dailyEntry)

    const normalizedPhone = normalizePhone(sale.metadata?.customer_phone)
    if (normalizedPhone) {
      const customerName = sale.metadata?.customer_name?.trim() || "Unknown"
      const existing = phoneMap.get(normalizedPhone) ?? {
        name: customerName,
        phone: sale.metadata?.customer_phone?.trim() ?? normalizedPhone,
        visits: 0,
        revenue: 0,
      }
      existing.visits += 1
      existing.revenue += amount
      if (customerName !== "Unknown") {
        existing.name = customerName
      }
      phoneMap.set(normalizedPhone, existing)
    }
  }

  const today = new Date()
  const dailySales: ChartDatum[] = []
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const key = dayKey(date)
    const entry = dailyMap.get(key) ?? { value: 0, count: 0 }
    dailySales.push({
      label: formatDayLabel(key),
      value: entry.value,
      count: entry.count,
    })
  }

  const customerRows = [...phoneMap.values()]
  const uniqueCustomers = customerRows.length
  const repeatCustomers = customerRows.filter((row) => row.visits >= 2).length
  const repeatRate =
    uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0

  const visitBuckets = { once: 0, twice: 0, threePlus: 0 }
  for (const row of customerRows) {
    if (row.visits === 1) {
      visitBuckets.once += 1
    } else if (row.visits === 2) {
      visitBuckets.twice += 1
    } else {
      visitBuckets.threePlus += 1
    }
  }

  const sortByValue = (a: ChartDatum, b: ChartDatum) => b.value - a.value

  return {
    currencyCode,
    totalRevenue,
    totalOrders,
    avgOrderValue,
    totalDiscount,
    uniqueCustomers,
    repeatCustomers,
    repeatRate,
    salesBySeller: [...sellerMap.entries()]
      .map(([label, data]) => ({ label, value: data.value, count: data.count }))
      .sort(sortByValue),
    salesByPayment: [...paymentMap.entries()]
      .map(([label, data]) => ({ label, value: data.value, count: data.count }))
      .sort(sortByValue),
    dailySales,
    topRepeatCustomers: customerRows
      .filter((row) => row.visits >= 2)
      .sort((a, b) => b.visits - a.visits || b.revenue - a.revenue)
      .slice(0, 8),
    visitDistribution: [
      { label: "1 visit", count: visitBuckets.once, value: visitBuckets.once },
      { label: "2 visits", count: visitBuckets.twice, value: visitBuckets.twice },
      {
        label: "3+ visits",
        count: visitBuckets.threePlus,
        value: visitBuckets.threePlus,
      },
    ],
  }
}
