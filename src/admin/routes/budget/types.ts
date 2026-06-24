export type ExpenseCategory = {
  id: string
  name: string
  slug: string
  description?: string | null
  sort_order: number
  is_active: boolean
}

export type Expense = {
  id: string
  category_id: string
  amount: number
  currency_code: string
  expense_date: string
  vendor?: string | null
  payment_method: string
  description: string
  funding_source_id?: string | null
  business_event_id?: string | null
  plan_id?: string | null
  plan_line_item_id?: string | null
  recorded_by: string
  notes?: string | null
}

export type MonthlyBudget = {
  id: string
  category_id: string
  year: number
  month: number
  amount: number
  currency_code: string
}

export type CashSnapshot = {
  id: string
  snapshot_date: string
  bank_balance: number
  cash_in_hand: number
  currency_code: string
  notes?: string | null
  recorded_by: string
}

export type FundingSource = {
  id: string
  type: string
  label: string
  founder_key?: string | null
  principal_amount?: number | null
  interest_rate?: number | null
  tenure_months?: number | null
  emi_amount?: number | null
  disbursement_date?: string | null
  status: string
  notes?: string | null
  use_of_funds_notes?: string | null
}

export type FundingTransaction = {
  id: string
  funding_source_id: string
  type: string
  amount: number
  transaction_date: string
  notes?: string | null
  recorded_by: string
}

export type FundingAllocation = {
  id: string
  funding_source_id: string
  category_id: string
  planned_amount: number
  notes?: string | null
}

export type CostSheetMetrics = {
  cogs_per_unit: number
  total_batch_cost: number
  effective_price: number
  unit_margin: number
  break_even_units: number | null
  units_remaining: number
  inventory_value: number
  gross_profit_to_date: number
  is_profitable_per_unit: boolean
}

export type ProductCostSheet = {
  id: string
  name: string
  product_id?: string | null
  variant_id?: string | null
  line_type: string
  fragrance_cost: number
  alcohol_cost: number
  bottle_cost: number
  cap_cost: number
  label_cost: number
  box_cost: number
  filling_cost: number
  packaging_other: number
  batch_quantity: number
  units_sold: number
  retail_price: number
  avg_discount_percent: number
  notes?: string | null
  metrics?: CostSheetMetrics
}

export type BusinessEvent = {
  id: string
  name: string
  event_date: string
  location?: string | null
  notes?: string | null
}

export type BudgetSettings = {
  id: string
  founder_1_name: string
  founder_2_name: string
  founder_3_name: string
  founder_1_email?: string | null
  founder_2_email?: string | null
  founder_3_email?: string | null
  default_currency: string
}

export type CatalogProduct = {
  id: string
  title: string
  variants: Array<{ id: string; title: string }>
}

export type PlanLineItem = {
  id: string
  plan_id: string
  label: string
  category_id: string
  quantity: number
  unit_price: number
  shipping: number
  sort_order: number
  notes?: string | null
  product_id?: string | null
  variant_id?: string | null
  planned_fragrance_name?: string | null
  planned?: number
  actual?: number
  remaining?: number
  category_name?: string
  fragrance_key?: string
  fragrance_label?: string
}

export type PlanInsights = {
  planned_total: number
  order_total: number
  actual_total: number
  recorded_expense_total?: number
  revision_savings_total?: number
  remaining_commitment: number
  variance: number
  variance_percent: number | null
  is_over_budget: boolean
  line_items: PlanLineItem[]
  by_category: Array<{
    category_id: string
    category_name: string
    planned: number
    actual: number
    variance: number
  }>
  by_fragrance: Array<{
    label: string
    planned: number
    actual: number
    line_count: number
  }>
  days_until_deadline: number | null
  is_overdue: boolean
  open_task_count: number
  open_milestone_count: number
  is_blocked: boolean
}

export type PlanRevision = {
  id: string
  plan_id: string
  revision_type: string
  item_label: string
  revised_item_label?: string | null
  category_id?: string | null
  original_quantity?: number | null
  revised_quantity?: number | null
  original_unit_price?: number | null
  revised_unit_price?: number | null
  original_total: number
  revised_total: number
  savings: number
  reason?: string | null
  actor: string
  created_at?: string
}

export type PlanRevisionSummary = {
  plan_id: string
  plan_title: string
  plan_status: string
  deferred_notes?: string | null
  total_savings: number
  revisions: PlanRevision[]
}

const REVISION_TYPE_LABELS: Record<string, string> = {
  omitted: "Item removed",
  qty_reduced: "Quantity reduced",
  downgraded: "Cheaper option",
  revised: "Revised",
  deferred: "Deferred (not on plan)",
}

export function revisionTypeLabel(type: string) {
  return REVISION_TYPE_LABELS[type] ?? type
}

export function formatRevisionChange(revision: PlanRevision): string {
  if (revision.revision_type === "deferred") {
    return revision.item_label
  }
  if (revision.revision_type === "omitted") {
    const qty =
      revision.original_quantity != null ? ` (${revision.original_quantity} removed)` : ""
    return `${revision.item_label}${qty}`
  }
  const parts: string[] = [revision.item_label]
  if (
    revision.original_quantity != null &&
    revision.revised_quantity != null &&
    revision.original_quantity !== revision.revised_quantity
  ) {
    parts.push(`${revision.original_quantity} → ${revision.revised_quantity}`)
  }
  if (
    revision.original_unit_price != null &&
    revision.revised_unit_price != null &&
    revision.original_unit_price !== revision.revised_unit_price
  ) {
    parts.push(`₹${revision.original_unit_price} → ₹${revision.revised_unit_price}`)
  }
  if (revision.revised_item_label && revision.revised_item_label !== revision.item_label) {
    parts.push(`now: ${revision.revised_item_label}`)
  }
  return parts.join(" · ")
}

export type BudgetPlan = {
  id: string
  title: string
  status: string
  deadline?: string | null
  created_by: string
  notes?: string | null
  deferred_notes?: string | null
  funding_source_id?: string | null
  invoice_url?: string | null
  created_at: string
  line_items: PlanLineItem[]
  revisions?: PlanRevision[]
  insights: PlanInsights
}

export type TaskActivity = {
  id: string
  task_id: string
  action: string
  actor: string
  details?: Record<string, unknown> | null
  created_at: string
}

export type FounderTask = {
  id: string
  title: string
  description?: string | null
  assigned_to: string
  created_by: string
  due_date?: string | null
  status: string
  priority: string
  plan_id?: string | null
  is_milestone: boolean
  attachment_url?: string | null
  activity: TaskActivity[]
  is_overdue: boolean
  plan_title?: string | null
}

export type BudgetStats = {
  currency: string
  period: { year: number; month: number; key: string }
  total_spent_this_month: number
  total_spent_all_time: number
  total_budget_this_month: number
  budget_remaining: number
  offline_revenue_all_time: number
  net_position_estimate: number
  budget_vs_actual: Array<{
    category_id: string
    category_name: string
    planned: number
    spent: number
    remaining: number
    percent_used: number | null
  }>
  spend_by_category: Array<{ label: string; value: number; category_id: string }>
  monthly_trend: Array<{ label: string; expenses: number; revenue: number }>
  latest_cash: CashSnapshot | null
  total_cash: number | null
  total_committed: number
  available_cash: number | null
  avg_monthly_burn: number
  runway_months: number | null
  founder_summaries: Array<{
    id: string
    founder_key?: string
    label: string
    contributed: number
    spent: number
    withdrawn: number
    balance: number
  }>
  loan_summaries: Array<Record<string, unknown>>
  upcoming_emis: Array<{
    funding_source_id: string
    label: string
    due_date: string
    amount: number
  }>
  event_summaries: Array<Record<string, unknown>>
  line_type_breakdown: Record<string, ProductCostSheet[]>
  pending_plans: BudgetPlan[]
  overdue_tasks: FounderTask[]
  open_tasks_by_founder: Record<string, number>
  fragrance_spend_summary: Array<{
    label: string
    planned: number
    actual: number
  }>
  total_revised_worth: number
  plan_revision_count: number
  plan_revision_summaries: PlanRevisionSummary[]
}

export type BudgetDashboardData = {
  settings: BudgetSettings
  categories: ExpenseCategory[]
  expenses: Expense[]
  monthly_budgets: MonthlyBudget[]
  cash_snapshots: CashSnapshot[]
  funding_sources: FundingSource[]
  funding_transactions: FundingTransaction[]
  funding_allocations: FundingAllocation[]
  cost_sheets: ProductCostSheet[]
  business_events: BusinessEvent[]
  plans: BudgetPlan[]
  tasks: FounderTask[]
  catalog_products: CatalogProduct[]
  stats: BudgetStats
  payment_methods: Array<{ value: string; label: string }>
  funding_types: Array<{ value: string; label: string }>
  transaction_types: Array<{ value: string; label: string }>
  line_types: Array<{ value: string; label: string }>
  plan_statuses: Array<{ value: string; label: string }>
  task_statuses: Array<{ value: string; label: string }>
  task_priorities: Array<{ value: string; label: string }>
  founder_options: Array<{ key: string; name: string; email?: string | null }>
}

export type BudgetTab =
  | "dashboard"
  | "plans"
  | "tasks"
  | "expenses"
  | "budgets"
  | "funding"
  | "cost-sheets"
  | "events"
  | "settings"

export const CURRENT_USER_KEY = "budget_current_founder"

export function fmt(amount: number, currency: string) {
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

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function labelFor(
  options: Array<{ value: string; label: string }>,
  value: string
) {
  return options.find((o) => o.value === value)?.label ?? value
}
