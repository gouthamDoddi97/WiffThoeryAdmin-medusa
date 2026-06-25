import { useState } from "react"
import type { BudgetStats } from "./types"
import { fmt, formatRevisionChange, revisionTypeLabel } from "./types"

function StatCard({
  label,
  value,
  hint,
  onClick,
  active,
}: {
  label: string
  value: string
  hint?: string
  onClick?: () => void
  active?: boolean
}) {
  const className = [
    "border rounded-xl p-4 bg-ui-bg-base flex flex-col gap-1 min-w-0 text-left w-full",
    onClick ? "cursor-pointer hover:bg-ui-bg-subtle transition-colors" : "",
    active ? "border-ui-fg-interactive ring-1 ring-ui-fg-interactive" : "border-ui-border-base",
  ].join(" ")

  const content = (
    <>
      <span className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</span>
      <span className="text-xl font-semibold truncate">{value}</span>
      {hint ? <span className="text-xs text-ui-fg-muted">{hint}</span> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
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
  const [showRevisions, setShowRevisions] = useState(false)
  const [showClaimableTax, setShowClaimableTax] = useState(false)
  const [cashPanel, setCashPanel] = useState<"none" | "on-hand" | "available">("none")
  const hasRevisions = stats.plan_revision_summaries.length > 0
  const hasClaimableTax = stats.claimable_tax_breakdown.length > 0
  const hasCashBreakdown = stats.funding_breakdown.founders.length > 0 || stats.funding_breakdown.total !== 0

  const toggleCashPanel = (panel: "on-hand" | "available") => {
    setShowRevisions(false)
    setShowClaimableTax(false)
    setCashPanel((current) => (current === panel ? "none" : panel))
  }

  const toggleRevisions = () => {
    setCashPanel("none")
    setShowClaimableTax(false)
    setShowRevisions((v) => !v)
  }

  const toggleClaimableTax = () => {
    setCashPanel("none")
    setShowRevisions(false)
    setShowClaimableTax((v) => !v)
  }

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
          label="Purchase plans revised worth"
          value={fmt(stats.total_revised_worth, currency)}
          hint={
            hasRevisions
              ? `${stats.plan_revision_summaries.length} plan(s) · click for details`
              : "Cuts & deferrals from plan edits"
          }
          onClick={hasRevisions ? toggleRevisions : undefined}
          active={showRevisions}
        />
        <StatCard
          label="Product spend"
          value={fmt(stats.total_product_spend, currency)}
          hint={
            stats.product_spend_summary.length > 0
              ? `${stats.product_spend_summary.length} product(s) tracked · materials by product below`
              : "Tag oil to products; optionally tag bottles, labels & boxes"
          }
        />
        <StatCard
          label="Claimable tax"
          value={fmt(stats.total_claimable_tax, currency)}
          hint={
            hasClaimableTax
              ? `${stats.claimable_tax_breakdown.length} completed plan(s) · click for breakdown`
              : "GST on completed purchase plans"
          }
          onClick={hasClaimableTax ? toggleClaimableTax : undefined}
          active={showClaimableTax}
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
          label="Total funding"
          value={fmt(stats.total_cash, currency)}
          hint={
            hasCashBreakdown
              ? "Sum of founder pools · click for breakdown"
              : stats.runway_months != null
                ? `~${stats.runway_months} mo runway`
                : "Record contributions in Funding tab"
          }
          onClick={() => toggleCashPanel("on-hand")}
          active={cashPanel === "on-hand"}
        />
        <StatCard
          label="Available cash"
          value={fmt(stats.available_cash, currency)}
          hint="Total funding minus active plan commitments · click for breakdown"
          onClick={() => toggleCashPanel("available")}
          active={cashPanel === "available"}
        />
        <StatCard
          label="Avg monthly burn"
          value={fmt(stats.avg_monthly_burn, currency)}
          hint="Last 6 months"
        />
      </div>

      {cashPanel === "on-hand" && (
        <Panel
          title="Total funding breakdown"
          subtitle="Contributions − withdrawals − tagged spend, per founder pool"
        >
          <div className="flex flex-col gap-4">
            <div className="border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle">
              <p className="text-xs text-ui-fg-subtle">Sum of founder pool balances</p>
              <p className="text-xl font-semibold">
                {fmt(stats.funding_breakdown.total, currency)}
              </p>
            </div>

            {stats.funding_breakdown.founders.length > 0 ? (
              <div className="flex flex-col gap-3">
                {stats.funding_breakdown.founders.map((founder) => (
                  <div
                    key={founder.id}
                    className="border border-ui-border-base rounded-lg p-3 bg-ui-bg-base flex flex-col gap-2"
                  >
                    <div className="flex justify-between gap-2">
                      <p className="font-medium text-sm">{founder.label}</p>
                      <p className="font-semibold">{fmt(founder.balance, currency)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-ui-fg-subtle">
                      <span>Contributed {fmt(founder.contributed, currency)}</span>
                      <span>Withdrawn {fmt(founder.withdrawn, currency)}</span>
                      <span>Spent {fmt(founder.spent, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ui-fg-subtle">
                No founder pools yet — record contributions in the <strong>Funding</strong> tab.
              </p>
            )}

            {stats.funding_breakdown.bank_snapshot && (
              <div className="border border-dashed border-ui-border-base rounded-lg p-3 text-sm">
                <p className="text-xs font-medium text-ui-fg-subtle mb-2">
                  Optional bank check (Budgets tab snapshot)
                </p>
                <p>
                  {formatDate(stats.funding_breakdown.bank_snapshot.snapshot_date)} · Bank{" "}
                  {fmt(stats.funding_breakdown.bank_snapshot.bank_balance, currency)} + cash{" "}
                  {fmt(stats.funding_breakdown.bank_snapshot.cash_in_hand, currency)} ={" "}
                  {fmt(stats.funding_breakdown.bank_snapshot.total, currency)}
                </p>
                {stats.funding_breakdown.bank_snapshot.total !== stats.funding_breakdown.total && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                    Differs from funding total by{" "}
                    {fmt(
                      stats.funding_breakdown.bank_snapshot.total - stats.funding_breakdown.total,
                      currency
                    )}
                    — tag expenses to founder pools or update contributions to reconcile.
                  </p>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      {cashPanel === "available" && (
        <Panel
          title="Available cash breakdown"
          subtitle="Part of total funding — not yet earmarked for active plans"
        >
          <div className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle">
                <p className="text-xs text-ui-fg-subtle">Total funding</p>
                <p className="text-lg font-semibold">
                  {fmt(stats.available_cash_breakdown.total_funding, currency)}
                </p>
              </div>
              <div className="border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle">
                <p className="text-xs text-ui-fg-subtle">Committed (active plans)</p>
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                  −{fmt(stats.available_cash_breakdown.total_committed, currency)}
                </p>
              </div>
              <div className="border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle">
                <p className="text-xs text-ui-fg-subtle">Available cash</p>
                <p className="text-lg font-semibold">
                  {fmt(stats.available_cash_breakdown.available, currency)}
                </p>
              </div>
            </div>

            {stats.available_cash_breakdown.plan_commitments.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-ui-fg-subtle">Reserved by active plans</p>
                {stats.available_cash_breakdown.plan_commitments.map((row) => (
                  <div
                    key={row.plan_id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm border-b border-ui-border-base pb-2 last:border-0"
                  >
                    <span className="font-medium">{row.plan_title}</span>
                    <span className="text-ui-fg-subtle text-xs sm:text-sm shrink-0">
                      {fmt(row.remaining_commitment, currency)} left of{" "}
                      {fmt(row.order_total, currency)}
                      {row.recorded > 0
                        ? ` (${fmt(row.recorded, currency)} already recorded)`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ui-fg-subtle">
                No unrecorded plan commitments — all active plan spend is already logged as expenses.
              </p>
            )}
          </div>
        </Panel>
      )}

      {showClaimableTax && hasClaimableTax && (
        <Panel
          title="Claimable tax breakdown"
          subtitle="Input GST recorded on completed purchase plans (invoiced purchases)"
        >
          <div className="flex flex-col gap-3">
            <div className="border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle">
              <p className="text-xs text-ui-fg-subtle">Total claimable</p>
              <p className="text-xl font-semibold">{fmt(stats.total_claimable_tax, currency)}</p>
            </div>
            {stats.claimable_tax_breakdown.map((row) => (
              <div
                key={row.plan_id}
                className="flex items-center justify-between gap-2 text-sm border-b border-ui-border-base pb-2 last:border-0"
              >
                <span className="font-medium">{row.plan_title}</span>
                <span className="text-ui-fg-subtle shrink-0">{fmt(row.tax_total, currency)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {showRevisions && hasRevisions && (
        <Panel
          title="Plan revisions & budget cuts"
          subtitle="What was reduced, removed, downgraded, or deferred — and why"
        >
          <div className="flex flex-col gap-4">
            {stats.plan_revision_summaries.map((summary) => (
              <div
                key={summary.plan_id}
                className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{summary.plan_title}</p>
                    <p className="text-xs text-ui-fg-subtle capitalize">{summary.plan_status}</p>
                  </div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {fmt(summary.total_savings, currency)} revised off
                  </p>
                </div>

                {summary.deferred_notes?.trim() && (
                  <div className="text-xs border border-amber-200 dark:border-amber-900/40 rounded-md p-2 bg-amber-50 dark:bg-amber-950/20">
                    <span className="font-medium text-amber-900 dark:text-amber-200">
                      Budget note:{" "}
                    </span>
                    <span className="whitespace-pre-wrap">{summary.deferred_notes}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {summary.revisions.map((revision) => (
                    <div
                      key={revision.id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 text-xs border-b border-ui-border-base pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">
                          {revisionTypeLabel(revision.revision_type)}
                        </span>
                        <span className="text-ui-fg-subtle"> · </span>
                        <span>{formatRevisionChange(revision)}</span>
                        {revision.reason?.trim() && revision.revision_type !== "deferred" && (
                          <p className="text-ui-fg-muted mt-0.5">
                            Reason: {revision.reason}
                          </p>
                        )}
                      </div>
                      {Number(revision.savings) > 0 && (
                        <span className="shrink-0 font-medium">
                          −{fmt(revision.savings, currency)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

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

      {stats.product_spend_summary.length > 0 && (
        <Panel
          title="Spend by product"
          subtitle="Oil requires a catalog product; bottles, atomizers, labels & boxes can be tagged optionally"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="text-ui-fg-subtle border-b border-ui-border-base">
                  <th className="text-left pb-2 pr-2">Product</th>
                  <th className="text-right pb-2 pr-2">Oil</th>
                  <th className="text-right pb-2 pr-2">Bottles</th>
                  <th className="text-right pb-2 pr-2">Labels</th>
                  <th className="text-right pb-2 pr-2">Boxes</th>
                  <th className="text-right pb-2 pr-2">Spent</th>
                  <th className="text-right pb-2">Planned</th>
                </tr>
              </thead>
              <tbody>
                {stats.product_spend_summary.map((row) => (
                  <tr key={row.fragrance_key} className="border-b border-ui-border-base last:border-0">
                    <td className="py-2 pr-2 font-medium">{row.label}</td>
                    <td className="py-2 pr-2 text-right text-ui-fg-subtle">
                      {row.spent.oil > 0 ? fmt(row.spent.oil, currency) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right text-ui-fg-subtle">
                      {row.spent.bottles > 0 ? fmt(row.spent.bottles, currency) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right text-ui-fg-subtle">
                      {row.spent.labels > 0 ? fmt(row.spent.labels, currency) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right text-ui-fg-subtle">
                      {row.spent.boxes > 0 ? fmt(row.spent.boxes, currency) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right">{fmt(row.spent_total, currency)}</td>
                    <td className="py-2 text-right text-ui-fg-subtle">
                      {row.planned_total > 0 ? fmt(row.planned_total, currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <Panel title="Purchase plans due soon" subtitle="Active plans with upcoming or overdue deadlines">
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
                    <span className="text-red-500 font-medium">{task.title}</span>
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
