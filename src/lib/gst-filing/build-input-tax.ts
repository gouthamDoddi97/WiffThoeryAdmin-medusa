import type { MedusaContainer } from "@medusajs/framework/types"
import { BUDGET_FINANCE_MODULE } from "../../modules/budget-finance"
import { monthRangeUtc } from "./period"

export type GstFilingExpenseRow = {
  id: string
  expense_date: string | Date
  vendor?: string | null
  description: string
  amount: number
  gst_amount: number
  payment_method?: string | null
  plan_id?: string | null
  plan_line_item_id?: string | null
  category_id?: string | null
  funding_source_id?: string | null
  recorded_by?: string | null
  notes?: string | null
  receipt_url?: string | null
}

export type InputTaxLine = {
  id: string
  date: string
  vendor: string | null
  description: string
  amount_inr: number
  gst_amount_inr: number
  taxable_value_inr: number
  from_plan: boolean
  payment_method: string | null
  payment_method_label: string | null
  recorded_by: string | null
  notes: string | null
  receipt_url: string | null
  category_id: string | null
  category_name: string | null
  plan_id: string | null
  plan_title: string | null
  funding_source_id: string | null
}

export type GstExpenseDetail = InputTaxLine & {
  currency_code: string
  plan_invoice_url: string | null
}

export type InputTaxSummary = {
  expense_count: number
  total_amount_inr: number
  total_input_gst_inr: number
  total_taxable_purchases_inr: number
  lines: InputTaxLine[]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function formatExpenseDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().slice(0, 10)
}

export async function loadExpensesForGstPeriod(
  container: MedusaContainer,
  year: number,
  month: number
): Promise<GstFilingExpenseRow[]> {
  const service = container.resolve(BUDGET_FINANCE_MODULE) as {
    listExpenses: (
      filters: Record<string, unknown>,
      config?: { take?: number; order?: Record<string, string> }
    ) => Promise<GstFilingExpenseRow[]>
  }

  const { start, end } = monthRangeUtc(year, month)
  const expenses = await service.listExpenses(
    {},
    { take: 2000, order: { expense_date: "ASC" } }
  )

  return expenses.filter((expense) => {
    const date = new Date(expense.expense_date)
    return date >= start && date <= end
  })
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  other: "Other",
}

type BudgetLookupMaps = {
  categoryNames: Map<string, string>
  planTitles: Map<string, string>
  planInvoices: Map<string, string | null>
}

async function loadBudgetLookupMaps(
  container: MedusaContainer,
  expenses: GstFilingExpenseRow[]
): Promise<BudgetLookupMaps> {
  const service = container.resolve(BUDGET_FINANCE_MODULE) as {
    listExpenseCategories: (
      filters: Record<string, unknown>,
      config?: { take?: number }
    ) => Promise<Array<{ id: string; name: string }>>
    listPlans: (
      filters: Record<string, unknown>,
      config?: { take?: number }
    ) => Promise<Array<{ id: string; title: string; invoice_url?: string | null }>>
  }

  const planIds = [
    ...new Set(
      expenses
        .map((expense) => expense.plan_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const [categories, plans] = await Promise.all([
    service.listExpenseCategories({}, { take: 200 }),
    planIds.length
      ? Promise.all(
          planIds.map(async (planId) => {
            const rows = await service.listPlans({ id: planId }, { take: 1 })
            return rows[0]
          })
        ).then((rows) => rows.filter(Boolean))
      : Promise.resolve([]),
  ])

  return {
    categoryNames: new Map(categories.map((row) => [row.id, row.name])),
    planTitles: new Map(plans.map((row) => [row.id, row.title])),
    planInvoices: new Map(plans.map((row) => [row.id, row.invoice_url ?? null])),
  }
}

function mapExpenseToInputTaxLine(
  expense: GstFilingExpenseRow,
  maps?: BudgetLookupMaps
): InputTaxLine {
  const amount = round2(Number(expense.amount ?? 0))
  const gst = round2(Number(expense.gst_amount ?? 0))
  const taxable = round2(Math.max(0, amount - gst))
  const planId = expense.plan_id ?? null
  const paymentMethod = expense.payment_method?.trim() || null
  const planInvoice = planId ? maps?.planInvoices.get(planId) ?? null : null
  const receiptUrl =
    expense.receipt_url?.trim() || planInvoice?.trim() || null

  return {
    id: expense.id,
    date: formatExpenseDate(expense.expense_date),
    vendor: expense.vendor?.trim() || null,
    description: expense.description,
    amount_inr: amount,
    gst_amount_inr: gst,
    taxable_value_inr: taxable,
    from_plan: Boolean(expense.plan_line_item_id || expense.plan_id),
    payment_method: paymentMethod,
    payment_method_label: paymentMethod
      ? PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod
      : null,
    recorded_by: expense.recorded_by?.trim() || null,
    notes: expense.notes?.trim() || null,
    receipt_url: receiptUrl,
    category_id: expense.category_id ?? null,
    category_name: expense.category_id
      ? maps?.categoryNames.get(expense.category_id) ?? null
      : null,
    plan_id: planId,
    plan_title: planId ? maps?.planTitles.get(planId) ?? null : null,
    funding_source_id: expense.funding_source_id ?? null,
  }
}

export async function buildInputTaxSummary(
  container: MedusaContainer,
  expenses: GstFilingExpenseRow[]
): Promise<InputTaxSummary> {
  const maps = await loadBudgetLookupMaps(container, expenses)
  const lines = expenses
    .filter((expense) => Number(expense.gst_amount ?? 0) > 0)
    .map((expense) => mapExpenseToInputTaxLine(expense, maps))

  const total_amount_inr = round2(
    lines.reduce((sum, line) => sum + line.amount_inr, 0)
  )
  const total_input_gst_inr = round2(
    lines.reduce((sum, line) => sum + line.gst_amount_inr, 0)
  )
  const total_taxable_purchases_inr = round2(
    lines.reduce((sum, line) => sum + line.taxable_value_inr, 0)
  )

  return {
    expense_count: lines.length,
    total_amount_inr,
    total_input_gst_inr,
    total_taxable_purchases_inr,
    lines,
  }
}

export async function loadGstExpenseDetail(
  container: MedusaContainer,
  expenseId: string
): Promise<GstExpenseDetail | null> {
  const service = container.resolve(BUDGET_FINANCE_MODULE) as {
    listExpenses: (
      filters: Record<string, unknown>,
      config?: { take?: number }
    ) => Promise<GstFilingExpenseRow[]>
  }

  const [expense] = await service.listExpenses({ id: expenseId }, { take: 1 })
  if (!expense || Number(expense.gst_amount ?? 0) <= 0) {
    return null
  }

  const maps = await loadBudgetLookupMaps(container, [expense])
  const line = mapExpenseToInputTaxLine(expense, maps)
  const planInvoice =
    expense.plan_id != null
      ? maps.planInvoices.get(expense.plan_id) ?? null
      : null

  return {
    ...line,
    currency_code: "inr",
    plan_invoice_url: planInvoice?.trim() || null,
  }
}
