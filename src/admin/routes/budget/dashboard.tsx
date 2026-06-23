import type { BudgetStats } from "./types"
import { fmt } from "./types"

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base flex flex-col gap-1 min-w-0">
      <span className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</span>
      <span className="text-xl font-semibold truncate">{value}</span>
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
  children: React.ReactNode
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

function HorizontalBars({
  rows,
  currency,
  formatValue,
}: {
  rows: Array<{ label: string; value: number; hint?: string }>
  currency: string
  formatValue?: (v: number) => string
}) {
  if (!rows.length) {
    return <p className="text-sm text-ui-fg-subtle">No data yet</p>
  }
  const max = Math.max(...rows.map((r) => r.value), 1)
  const format = formatValue ?? ((v: number) => fmt(v, currency))

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1">
          <div className="flex justify-between gap-2 text-xs">
            <span className="font-medium truncate">{row.label}</span>
            <span className="text-ui-fg-subtle shrink-0">
              {format(row.value)}
              {row.hint ? ` · ${row.hint}` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ui-bg-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-ui-fg-interactive"
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 4 : 0)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function TrendChart({
  data,
  currency,
}: {
  data: BudgetStats["monthly_trend"]
  currency: string
}) {
  const max = Math.max(...data.flatMap((d) => [d.expenses, d.revenue]), 1)

  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((point) => (
        <div key={point.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0">
          <div className="flex items-end gap-0.5 w-full h-[85%]">
            <div
              className="flex-1 rounded-t bg-red-400/80"
              style={{ height: `${Math.max((point.expenses / max) * 100, 2)}%` }}
              title={`Expenses: ${fmt(point.expenses, currency)}`}
            />
            <div
              className="flex-1 rounded-t bg-emerald-500/80"
              style={{ height: `${Math.max((point.revenue / max) * 100, 2)}%` }}
              title={`Revenue: ${fmt(point.revenue, currency)}`}
            />
          </div>
          <span className="text-[9px] text-ui-fg-subtle truncate w-full text-center">
            {point.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function BudgetDashboardView({ stats }: { stats: BudgetStats }) {
  const currency = stats.currency

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard
          label="Spent this month"
          value={fmt(stats.total_spent_this_month, currency)}
        />
        <StatCard
          label="Budget left"
          value={fmt(stats.budget_remaining, currency)}
          hint={`of ${fmt(stats.total_budget_this_month, currency)} planned`}
        />
        <StatCard
          label="Offline revenue"
          value={fmt(stats.offline_revenue_all_time, currency)}
          hint="All time from offline sales"
        />
        <StatCard
          label="Net estimate"
          value={fmt(stats.net_position_estimate, currency)}
          hint="Revenue − all expenses"
        />
        <StatCard
          label="Cash on hand"
          value={stats.total_cash != null ? fmt(stats.total_cash, currency) : "—"}
          hint={
            stats.total_committed > 0
              ? `${fmt(stats.total_committed, currency)} committed`
              : stats.runway_months != null
                ? `~${stats.runway_months} mo runway`
                : "Add a cash snapshot"
          }
        />
        <StatCard
          label="Available cash"
          value={
            stats.available_cash != null ? fmt(stats.available_cash, currency) : "—"
          }
          hint="Cash minus active plan commitments"
        />
        <StatCard
          label="Avg monthly burn"
          value={fmt(stats.avg_monthly_burn, currency)}
          hint="Last 6 months"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Founder pools" subtitle="Contributions vs spend tagged to each founder">
          <HorizontalBars
            currency={currency}
            rows={stats.founder_summaries.map((f) => ({
              label: f.label,
              value: f.contributed,
              hint: `spent ${fmt(f.spent, currency)} · bal ${fmt(f.balance, currency)}`,
            }))}
          />
        </Panel>

        <Panel title="Spend by category" subtitle="Current month">
          <HorizontalBars
            currency={currency}
            rows={stats.spend_by_category.map((row) => ({
              label: row.label,
              value: row.value,
            }))}
          />
        </Panel>

        <Panel title="Revenue vs expenses" subtitle="Last 6 months (red = spend, green = offline revenue)">
          <TrendChart data={stats.monthly_trend} currency={currency} />
        </Panel>

        <Panel title="Budget vs actual" subtitle="Current month by category">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ui-fg-subtle border-b border-ui-border-base">
                  <th className="text-left pb-2 pr-2">Category</th>
                  <th className="text-right pb-2 pr-2">Planned</th>
                  <th className="text-right pb-2 pr-2">Spent</th>
                  <th className="text-right pb-2">Left</th>
                </tr>
              </thead>
              <tbody>
                {stats.budget_vs_actual.map((row) => (
                  <tr key={row.category_id} className="border-b border-ui-border-base last:border-0">
                    <td className="py-2 pr-2">{row.category_name}</td>
                    <td className="py-2 pr-2 text-right">{fmt(row.planned, currency)}</td>
                    <td className="py-2 pr-2 text-right">{fmt(row.spent, currency)}</td>
                    <td
                      className={`py-2 text-right font-medium ${row.remaining < 0 ? "text-red-500" : ""}`}
                    >
                      {fmt(row.remaining, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {stats.fragrance_spend_summary.length > 0 && (
        <Panel
          title="Spend by fragrance (active plans)"
          subtitle="Planned vs actual materials tagged to each product or planned name"
        >
          <HorizontalBars
            currency={currency}
            rows={stats.fragrance_spend_summary.map((row) => ({
              label: row.label,
              value: row.planned,
              hint: `actual ${fmt(row.actual, currency)}`,
            }))}
          />
        </Panel>
      )}

      {stats.upcoming_emis.length > 0 && (
        <Panel title="Upcoming EMIs" subtitle="Next loan repayments">
          <div className="flex flex-col gap-2">
            {stats.upcoming_emis.map((emi) => (
              <div
                key={`${emi.funding_source_id}-${emi.due_date}`}
                className="flex justify-between text-sm border-b border-ui-border-base pb-2 last:border-0"
              >
                <span>
                  {emi.label} · {formatDate(emi.due_date)}
                </span>
                <span className="font-medium">{fmt(emi.amount, currency)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {(stats.pending_plans.length > 0 || stats.overdue_tasks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stats.pending_plans.length > 0 && (
            <Panel title="Plans due soon" subtitle="Active plans with upcoming or overdue deadlines">
              <div className="flex flex-col gap-2">
                {stats.pending_plans.slice(0, 6).map((plan) => (
                  <div
                    key={plan.id}
                    className="flex justify-between gap-2 text-sm border-b border-ui-border-base pb-2 last:border-0"
                  >
                    <span className={plan.insights.is_overdue ? "text-red-500 font-medium" : ""}>
                      {plan.title}
                      {plan.insights.days_until_deadline != null
                        ? ` · ${plan.insights.days_until_deadline}d`
                        : ""}
                      {plan.insights.is_blocked ? " · blocked" : ""}
                    </span>
                    <span className="text-ui-fg-subtle shrink-0">
                      {fmt(plan.insights.actual_total, currency)} / {fmt(plan.insights.planned_total, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {stats.overdue_tasks.length > 0 && (
            <Panel title="Overdue tasks" subtitle="Assigned work past due date">
              <div className="flex flex-col gap-2">
                {stats.overdue_tasks.slice(0, 6).map((task) => (
                  <div
                    key={task.id}
                    className="flex justify-between gap-2 text-sm border-b border-ui-border-base pb-2 last:border-0"
                  >
                    <span className="text-red-500 font-medium">
                      {task.is_milestone ? "◆ " : ""}{task.title}
                    </span>
                    <span className="text-ui-fg-subtle shrink-0">{task.assigned_to}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value))
  } catch {
    return value
  }
}
