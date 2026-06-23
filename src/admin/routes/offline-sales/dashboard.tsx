import type { ReactNode } from "react"
import type { ChartDatum, OfflineSaleStats, RepeatCustomerRow } from "./analytics"

const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#22c55e",
  "#3b82f6",
]

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency.toUpperCase()} ${amount}`
  }
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base flex flex-col gap-1 min-w-0">
      <span className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-semibold truncate">{value}</span>
      {hint ? <span className="text-xs text-ui-fg-muted">{hint}</span> : null}
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base flex flex-col gap-4 min-w-0">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle ? <p className="text-xs text-ui-fg-subtle mt-0.5">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}

function HorizontalBarChart({
  data,
  currencyCode,
  emptyLabel = "No data yet",
  formatValue,
}: {
  data: ChartDatum[]
  currencyCode: string
  emptyLabel?: string
  formatValue?: (value: number) => string
}) {
  if (!data.length) {
    return <p className="text-sm text-ui-fg-subtle">{emptyLabel}</p>
  }

  const max = Math.max(...data.map((item) => item.value), 1)
  const format = formatValue ?? ((value: number) => fmt(value, currencyCode))

  return (
    <div className="flex flex-col gap-3">
      {data.map((item, index) => (
        <div key={item.label} className="flex flex-col gap-1">
          <div className="flex justify-between gap-2 text-xs">
            <span className="font-medium truncate">{item.label}</span>
            <span className="text-ui-fg-subtle shrink-0">
              {format(item.value)}
              {item.count != null && formatValue == null
                ? ` · ${item.count} sale${item.count === 1 ? "" : "s"}`
                : null}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ui-bg-subtle overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%`,
                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function DonutChart({
  data,
  currencyCode,
}: {
  data: ChartDatum[]
  currencyCode: string
}) {
  if (!data.length) {
    return <p className="text-sm text-ui-fg-subtle">No payment data yet</p>
  }

  const total = data.reduce((sum, item) => sum + item.value, 0) || 1
  let offset = 0
  const radius = 42
  const circumference = 2 * Math.PI * radius

  const segments = data.map((item, index) => {
    const fraction = item.value / total
    const dash = fraction * circumference
    const segment = {
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
      dash,
      offset,
    }
    offset += dash
    return segment
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--bg-subtle)" strokeWidth="12" />
        {segments.map((segment) => (
          <circle
            key={segment.label}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="12"
            strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
            strokeDashoffset={-segment.offset}
            transform="rotate(-90 50 50)"
          />
        ))}
        <text
          x="50"
          y="48"
          textAnchor="middle"
          className="fill-ui-fg-base text-[8px] font-semibold"
        >
          {fmt(total, currencyCode)}
        </text>
        <text
          x="50"
          y="58"
          textAnchor="middle"
          className="fill-ui-fg-subtle text-[6px]"
        >
          total
        </text>
      </svg>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <span className="truncate flex-1">{segment.label}</span>
            <span className="text-ui-fg-subtle shrink-0">
              {Math.round((segment.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ColumnChart({
  data,
  currencyCode,
}: {
  data: ChartDatum[]
  currencyCode: string
}) {
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="flex items-end gap-1.5 h-36">
      {data.map((item) => {
        const height = item.value > 0 ? Math.max((item.value / max) * 100, 8) : 2
        return (
          <div
            key={item.label}
            className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end group"
            title={`${item.label}: ${fmt(item.value, currencyCode)}${item.count ? ` (${item.count})` : ""}`}
          >
            <div
              className="w-full rounded-t-md bg-ui-fg-interactive transition-all group-hover:opacity-80"
              style={{ height: `${height}%`, minHeight: item.value > 0 ? "4px" : "2px" }}
            />
            <span className="text-[9px] text-ui-fg-subtle truncate w-full text-center leading-none">
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RepeatCustomersTable({
  rows,
  currencyCode,
}: {
  rows: RepeatCustomerRow[]
  currencyCode: string
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-ui-fg-subtle">
        No repeat customers yet. Add phone numbers on sales to track return visits.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ui-fg-subtle border-b border-ui-border-base">
            <th className="pb-2 pr-3 font-medium">Customer</th>
            <th className="pb-2 pr-3 font-medium">Phone</th>
            <th className="pb-2 pr-3 font-medium text-right">Visits</th>
            <th className="pb-2 font-medium text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.phone} className="border-b border-ui-border-base last:border-0">
              <td className="py-2 pr-3">{row.name}</td>
              <td className="py-2 pr-3 text-ui-fg-subtle">{row.phone}</td>
              <td className="py-2 pr-3 text-right font-medium">{row.visits}</td>
              <td className="py-2 text-right">{fmt(row.revenue, currencyCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function OfflineSalesDashboard({ stats }: { stats: OfflineSaleStats }) {
  const currency = stats.currencyCode

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Total revenue" value={fmt(stats.totalRevenue, currency)} />
        <StatCard label="Orders" value={String(stats.totalOrders)} />
        <StatCard label="Avg order" value={fmt(stats.avgOrderValue, currency)} />
        <StatCard
          label="Repeat customers"
          value={String(stats.repeatCustomers)}
          hint={
            stats.uniqueCustomers > 0
              ? `${stats.repeatRate}% of ${stats.uniqueCustomers} tracked`
              : "Add phone numbers to track"
          }
        />
        <StatCard label="Discounts given" value={fmt(stats.totalDiscount, currency)} />
        <StatCard
          label="Tracked customers"
          value={String(stats.uniqueCustomers)}
          hint="Unique phone numbers"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Revenue by seller" subtitle="Total paid amount per salesperson">
          <HorizontalBarChart data={stats.salesBySeller} currencyCode={currency} />
        </Panel>

        <Panel title="Payment methods" subtitle="Share of revenue by payment type">
          <DonutChart data={stats.salesByPayment} currencyCode={currency} />
        </Panel>

        <Panel title="Daily sales" subtitle="Revenue over the last 14 days">
          <ColumnChart data={stats.dailySales} currencyCode={currency} />
        </Panel>

        <Panel
          title="Customer visit frequency"
          subtitle="How often tracked customers return (by phone)"
        >
          <HorizontalBarChart
            data={stats.visitDistribution}
            currencyCode={currency}
            formatValue={(value) => `${value} customer${value === 1 ? "" : "s"}`}
            emptyLabel="Add customer phone numbers to see visit patterns"
          />
        </Panel>
      </div>

      <Panel title="Top repeat customers" subtitle="Customers with 2 or more visits">
        <RepeatCustomersTable rows={stats.topRepeatCustomers} currencyCode={currency} />
      </Panel>
    </div>
  )
}
