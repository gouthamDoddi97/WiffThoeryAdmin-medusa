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
  plan_line_item_id?: string | null
  notes?: string | null
}

export type InputTaxSummary = {
  expense_count: number
  total_amount_inr: number
  total_input_gst_inr: number
  total_taxable_purchases_inr: number
  lines: Array<{
    id: string
    date: string
    vendor: string | null
    description: string
    amount_inr: number
    gst_amount_inr: number
    taxable_value_inr: number
    from_plan: boolean
  }>
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

export function buildInputTaxSummary(
  expenses: GstFilingExpenseRow[]
): InputTaxSummary {
  const lines = expenses
    .filter((expense) => Number(expense.gst_amount ?? 0) > 0)
    .map((expense) => {
      const amount = round2(Number(expense.amount ?? 0))
      const gst = round2(Number(expense.gst_amount ?? 0))
      const taxable = round2(Math.max(0, amount - gst))

      return {
        id: expense.id,
        date: formatExpenseDate(expense.expense_date),
        vendor: expense.vendor?.trim() || null,
        description: expense.description,
        amount_inr: amount,
        gst_amount_inr: gst,
        taxable_value_inr: taxable,
        from_plan: Boolean(expense.plan_line_item_id),
      }
    })

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
