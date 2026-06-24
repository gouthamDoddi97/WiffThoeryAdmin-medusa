import { MedusaRequest } from "@medusajs/framework/http"
import type { INotificationModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { BUDGET_FINANCE_MODULE } from "../../modules/budget-finance"
import { listOfflineSales } from "../offline-sales/shared"

export const MATERIAL_CATEGORIES = [
  {
    name: "Fragrance oil",
    slug: "fragrance-oil",
    sort_order: 1,
    description: "Quantity in kg — 1 unit = 1 kg oil (e.g. 5 kg → qty 5, 500 g → qty 0.5)",
  },
  { name: "Bottles & atomizers", slug: "bottles-atomizers", sort_order: 2 },
  { name: "Labels", slug: "labels", sort_order: 3 },
  { name: "Boxes", slug: "boxes", sort_order: 4 },
]

export const DEFAULT_EXPENSE_CATEGORIES = [
  ...MATERIAL_CATEGORIES,
  { name: "Product / COGS (other)", slug: "product-cogs", sort_order: 5 },
  { name: "Inventory & batches", slug: "inventory", sort_order: 6 },
  { name: "Marketing", slug: "marketing", sort_order: 7 },
  { name: "Offline / retail", slug: "offline-retail", sort_order: 8 },
  { name: "Operations", slug: "operations", sort_order: 9 },
  { name: "People", slug: "people", sort_order: 10 },
  { name: "Equipment (CapEx)", slug: "capex", sort_order: 11 },
  { name: "Finance & fees", slug: "finance", sort_order: 12 },
  { name: "Legal & compliance", slug: "legal", sort_order: 13 },
]

export const FOUNDER_KEYS = ["founder_1", "founder_2", "founder_3"] as const

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
]

export const FUNDING_TYPES = [
  { value: "founder", label: "Founder contribution" },
  { value: "loan", label: "Loan" },
  { value: "investor", label: "Investor" },
  { value: "other", label: "Other" },
]

export const TRANSACTION_TYPES = [
  { value: "contribution", label: "Contribution / deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "disbursement", label: "Loan disbursement" },
  { value: "emi_payment", label: "EMI / repayment" },
  { value: "interest", label: "Interest paid" },
  { value: "other", label: "Other" },
]

export const LINE_TYPES = [
  { value: "core", label: "Core line" },
  { value: "clone", label: "Clone" },
  { value: "offline_only", label: "Offline only" },
]

export const PLAN_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

export const PLAN_REVISION_TYPES = [
  { value: "omitted", label: "Item removed" },
  { value: "qty_reduced", label: "Quantity reduced" },
  { value: "downgraded", label: "Cheaper option" },
  { value: "revised", label: "Revised" },
  { value: "deferred", label: "Deferred (not on plan)" },
] as const

export function revisionTypeLabel(type: string) {
  return PLAN_REVISION_TYPES.find((t) => t.value === type)?.label ?? type
}

export function formatRevisionChange(revision: {
  revision_type: string
  item_label: string
  revised_item_label?: string | null
  original_quantity?: number | null
  revised_quantity?: number | null
  original_unit_price?: number | null
  revised_unit_price?: number | null
  original_total?: number
  revised_total?: number
  savings?: number
}): string {
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

type PlanLineSnapshot = {
  id: string
  label: string
  category_id: string
  quantity: number
  unit_price: number
  shipping?: number
}

export function detectPlanLineRevisions(
  planId: string,
  actor: string,
  reason: string | null,
  oldItems: PlanLineSnapshot[],
  newItems: PlanLineItemInput[]
) {
  const oldById = new Map(oldItems.map((item) => [item.id, item]))
  const newById = new Map(
    newItems.filter((item) => item.id).map((item) => [item.id as string, item])
  )
  const revisions: Array<Record<string, unknown>> = []

  for (const old of oldItems) {
    if (newById.has(old.id)) continue
    const originalTotal = lineItemAmount(old)
    revisions.push({
      plan_id: planId,
      revision_type: "omitted",
      item_label: old.label,
      category_id: old.category_id,
      original_quantity: Number(old.quantity),
      revised_quantity: 0,
      original_unit_price: Number(old.unit_price),
      revised_unit_price: 0,
      original_total: originalTotal,
      revised_total: 0,
      savings: originalTotal,
      reason,
      actor,
    })
  }

  for (const newItem of newItems) {
    if (!newItem.id) continue
    const old = oldById.get(newItem.id)
    if (!old) continue

    const oldTotal = lineItemAmount(old)
    const newTotal = lineItemAmount({
      quantity: Number(newItem.quantity),
      unit_price: Number(newItem.unit_price),
      shipping: Number(newItem.shipping ?? 0),
    })
    if (newTotal >= oldTotal - 0.001) continue

    const savings = Math.round((oldTotal - newTotal) * 100) / 100
    const qtyDown = Number(newItem.quantity) < Number(old.quantity)
    const priceDown = Number(newItem.unit_price) < Number(old.unit_price)
    const labelChanged = newItem.label.trim() !== old.label

    let revisionType = "revised"
    if (qtyDown && !priceDown && !labelChanged) revisionType = "qty_reduced"
    else if (priceDown && !qtyDown && !labelChanged) revisionType = "downgraded"
    else if (labelChanged && (priceDown || qtyDown)) revisionType = "downgraded"

    revisions.push({
      plan_id: planId,
      revision_type: revisionType,
      item_label: old.label,
      revised_item_label: labelChanged ? newItem.label.trim() : null,
      category_id: old.category_id,
      original_quantity: Number(old.quantity),
      revised_quantity: Number(newItem.quantity),
      original_unit_price: Number(old.unit_price),
      revised_unit_price: Number(newItem.unit_price),
      original_total: oldTotal,
      revised_total: newTotal,
      savings,
      reason,
      actor,
    })
  }

  return revisions
}

export async function recordPlanRevisionsOnUpdate(
  req: MedusaRequest,
  planId: string,
  options: {
    actor: string
    reason?: string | null
    oldLineItems: PlanLineSnapshot[]
    newLineItems?: PlanLineItemInput[]
  }
) {
  if (!options.newLineItems?.length && !options.oldLineItems.length) {
    return []
  }
  if (!options.newLineItems) {
    return []
  }

  const reason = options.reason?.trim() || null
  const payloads = detectPlanLineRevisions(
    planId,
    options.actor,
    reason,
    options.oldLineItems,
    options.newLineItems
  )

  if (!payloads.length) {
    return []
  }

  const service = getBudgetService(req)
  const created = await service.createPlanRevisions(payloads)
  await logPlanActivity(req, planId, "revisions_recorded", options.actor, {
    count: created.length,
    savings: created.reduce(
      (sum: number, row: { savings?: number }) => sum + Number(row.savings ?? 0),
      0
    ),
  })
  return created
}

export const TASK_STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
]

export const TASK_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

export type PlanLineItemInput = {
  id?: string
  label: string
  category_id: string
  quantity: number
  unit_price: number
  shipping?: number
  sort_order?: number
  notes?: string | null
  product_id?: string | null
  variant_id?: string | null
  planned_fragrance_name?: string | null
}

export type CatalogProduct = {
  id: string
  title: string
  variants: Array<{ id: string; title: string }>
}

export type CatalogMaps = {
  products: Map<string, { title: string; variants: Map<string, string> }>
}

export function buildCatalogMaps(products: CatalogProduct[]): CatalogMaps {
  const map = new Map<string, { title: string; variants: Map<string, string> }>()
  for (const product of products) {
    const variants = new Map<string, string>()
    for (const variant of product.variants ?? []) {
      variants.set(variant.id, variant.title)
    }
    map.set(product.id, { title: product.title, variants })
  }
  return { products: map }
}

export function resolveFragranceKey(item: {
  product_id?: string | null
  variant_id?: string | null
  planned_fragrance_name?: string | null
}): string {
  if (item.variant_id) {
    return `variant:${item.variant_id}`
  }
  if (item.product_id) {
    return `product:${item.product_id}`
  }
  const planned = item.planned_fragrance_name?.trim()
  if (planned) {
    return `planned:${planned.toLowerCase()}`
  }
  return "shared"
}

export function resolveFragranceLabel(
  item: {
    product_id?: string | null
    variant_id?: string | null
    planned_fragrance_name?: string | null
  },
  catalog: CatalogMaps
): string {
  if (item.variant_id) {
    for (const [productId, product] of catalog.products) {
      const variantTitle = product.variants.get(item.variant_id)
      if (variantTitle) {
        return `${product.title} — ${variantTitle}`
      }
      if (productId === item.product_id) {
        return `${product.title} — ${variantTitle ?? item.variant_id}`
      }
    }
  }
  if (item.product_id) {
    const product = catalog.products.get(item.product_id)
    if (product) {
      return product.title
    }
  }
  const planned = item.planned_fragrance_name?.trim()
  if (planned) {
    return `${planned} (planned)`
  }
  return "Shared / unassigned"
}

export function lineItemAmount(item: {
  quantity: number
  unit_price: number
  shipping?: number
}) {
  const subtotal = Number(item.quantity) * Number(item.unit_price)
  const shipping = Number(item.shipping ?? 0)
  return Math.round((subtotal + shipping) * 100) / 100
}

export async function getPlanPlannedTotal(
  req: MedusaRequest,
  planId: string
): Promise<number> {
  const service = getBudgetService(req)
  const items = await service.listPlanLineItems({ plan_id: planId }, { take: 200 })
  return items.reduce(
    (sum: number, item: { quantity: number; unit_price: number; shipping?: number }) =>
      sum + lineItemAmount(item),
    0
  )
}

export function assertPlanInvoiceForCompletion(
  plannedTotal: number,
  invoiceUrl?: string | null
) {
  if (plannedTotal > 0 && !invoiceUrl?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Upload an invoice before marking this plan complete (required when planned amount is set)"
    )
  }
}

export async function createExpensesFromCompletedPlan(
  req: MedusaRequest,
  planId: string,
  options: { actor: string; invoiceUrl?: string | null; expenseDate?: Date }
) {
  const service = getBudgetService(req)
  const [plan] = await service.listPlans({ id: planId }, { take: 1 })
  if (!plan) {
    return []
  }

  const lineItems = await service.listPlanLineItems({ plan_id: planId }, { take: 200 })
  const existingExpenses = await service.listExpenses({ plan_id: planId }, { take: 200 })

  const paidByLine = new Map<string, number>()
  for (const expense of existingExpenses) {
    if (!expense.plan_line_item_id) continue
    paidByLine.set(
      expense.plan_line_item_id,
      (paidByLine.get(expense.plan_line_item_id) ?? 0) + Number(expense.amount)
    )
  }

  const receiptUrl = options.invoiceUrl?.trim() || plan.invoice_url || null
  const expenseDate = options.expenseDate ?? new Date()

  const payloads = lineItems
    .map(
      (item: {
        id: string
        label: string
        category_id: string
        quantity: number
        unit_price: number
        shipping?: number
      }) => {
        const planned = lineItemAmount(item)
        const paid = paidByLine.get(item.id) ?? 0
        const amount = Math.round((planned - paid) * 100) / 100
        if (amount <= 0) return null

        return {
          category_id: item.category_id,
          amount,
          currency_code: "inr",
          expense_date: expenseDate,
          vendor: null,
          payment_method: "upi",
          description: `${plan.title} — ${item.label}`,
          funding_source_id: plan.funding_source_id ?? null,
          business_event_id: null,
          plan_id: planId,
          plan_line_item_id: item.id,
          recorded_by: options.actor,
          notes: "Auto-recorded when plan was marked complete",
          receipt_url: receiptUrl,
        }
      }
    )
    .filter((payload): payload is NonNullable<typeof payload> => payload !== null)

  if (!payloads.length) {
    return []
  }

  return service.createExpenses(payloads)
}

export async function resyncExpensesForCompletedPlan(
  req: MedusaRequest,
  planId: string,
  actor: string
) {
  const service = getBudgetService(req)
  const [plan] = await service.listPlans({ id: planId }, { take: 1 })
  if (!plan || plan.status !== "completed") {
    return []
  }

  const planExpenses = await service.listExpenses({ plan_id: planId }, { take: 200 })
  const autoExpenses = planExpenses.filter((e: { notes?: string | null }) =>
    e.notes?.includes("Auto-recorded when plan was marked complete")
  )

  if (autoExpenses.length) {
    await service.deleteExpenses(autoExpenses.map((e: { id: string }) => e.id))
  }

  return createExpensesFromCompletedPlan(req, planId, {
    actor,
    invoiceUrl: plan.invoice_url,
  })
}

export async function syncCompletedPlanExpensesIfStale(
  req: MedusaRequest,
  planId: string,
  actor: string
) {
  const service = getBudgetService(req)
  const items = await service.listPlanLineItems({ plan_id: planId }, { take: 200 })
  const planned = items.reduce(
    (sum: number, item: { quantity: number; unit_price: number; shipping?: number }) =>
      sum + lineItemAmount(item),
    0
  )
  const expenses = await service.listExpenses({ plan_id: planId }, { take: 200 })
  if (!expenses.length) {
    return false
  }

  const autoExpenses = expenses.filter((e: { notes?: string | null }) =>
    e.notes?.includes("Auto-recorded when plan was marked complete")
  )
  if (autoExpenses.length !== expenses.length) {
    return false
  }

  const recorded = autoExpenses.reduce(
    (sum: number, e: { amount: number }) => sum + Number(e.amount),
    0
  )
  if (Math.abs(recorded - planned) < 0.01) {
    return false
  }

  await resyncExpensesForCompletedPlan(req, planId, actor)
  return true
}

export function computePlanInsights(
  plan: { id: string; status: string; deadline?: string | null; title: string },
  lineItems: Array<{
    id: string
    label: string
    category_id: string
    quantity: number
    unit_price: number
    shipping?: number
    product_id?: string | null
    variant_id?: string | null
    planned_fragrance_name?: string | null
  }>,
  expenses: Array<{ plan_id?: string | null; plan_line_item_id?: string | null; amount: number; category_id: string }>,
  categoryMap: Map<string, { name: string }>,
  tasks: Array<{ plan_id?: string | null; status: string; is_milestone?: boolean }>,
  catalog: CatalogMaps,
  revisions: Array<{ revision_type: string; savings?: number }> = []
) {
  const planExpenses = expenses.filter((e) => e.plan_id === plan.id)
  const orderTotal = lineItems.reduce((sum, item) => sum + lineItemAmount(item), 0)
  const recordedTotal = planExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const autoRevisions = revisions.filter((row) => row.revision_type !== "deferred")
  const revisionSavingsTotal = autoRevisions.reduce(
    (sum, row) => sum + Number(row.savings ?? 0),
    0
  )
  const originalPlannedTotal =
    revisionSavingsTotal > 0
      ? Math.round((orderTotal + revisionSavingsTotal) * 100) / 100
      : orderTotal

  const plannedTotal = originalPlannedTotal
  const actualTotal = orderTotal
  const remaining = Math.max(revisionSavingsTotal, 0)
  const variance = revisionSavingsTotal
  const variancePercent =
    originalPlannedTotal > 0
      ? Math.round((revisionSavingsTotal / originalPlannedTotal) * 100)
      : null

  const lineInsights = lineItems.map((item) => {
    const planned = lineItemAmount(item)
    return {
      ...item,
      planned,
      actual: planned,
      remaining: 0,
      category_name: categoryMap.get(item.category_id)?.name ?? item.category_id,
      fragrance_key: resolveFragranceKey(item),
      fragrance_label: resolveFragranceLabel(item, catalog),
    }
  })

  const categoryBreakdown = new Map<string, { planned: number; actual: number }>()
  for (const item of lineItems) {
    const entry = categoryBreakdown.get(item.category_id) ?? { planned: 0, actual: 0 }
    const amount = lineItemAmount(item)
    entry.planned += amount
    entry.actual += amount
    categoryBreakdown.set(item.category_id, entry)
  }

  const byCategory = [...categoryBreakdown.entries()].map(([category_id, vals]) => ({
    category_id,
    category_name: categoryMap.get(category_id)?.name ?? category_id,
    planned: vals.planned,
    actual: vals.actual,
    variance: vals.planned - vals.actual,
  }))

  const fragranceBreakdown = new Map<
    string,
    { label: string; planned: number; actual: number; line_count: number }
  >()

  for (const item of lineItems) {
    const key = resolveFragranceKey(item)
    const entry = fragranceBreakdown.get(key) ?? {
      label: resolveFragranceLabel(item, catalog),
      planned: 0,
      actual: 0,
      line_count: 0,
    }
    const amount = lineItemAmount(item)
    entry.planned += amount
    entry.actual += amount
    entry.line_count += 1
    fragranceBreakdown.set(key, entry)
  }

  const byFragrance = [...fragranceBreakdown.values()]
    .filter((row) => row.planned > 0 || row.actual > 0)
    .sort((a, b) => b.planned - a.planned)

  let daysUntilDeadline: number | null = null
  let isOverdue = false
  if (plan.deadline) {
    const due = new Date(plan.deadline)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    daysUntilDeadline = Math.round((due.getTime() - today.getTime()) / 86400000)
    isOverdue = daysUntilDeadline < 0 && plan.status === "active"
  }

  const planTasks = tasks.filter((t) => t.plan_id === plan.id)
  const openTasks = planTasks.filter((t) => t.status !== "done" && t.status !== "cancelled")
  const openMilestones = openTasks.filter((t) => t.is_milestone)

  return {
    planned_total: plannedTotal,
    order_total: orderTotal,
    actual_total: actualTotal,
    recorded_expense_total: recordedTotal,
    revision_savings_total: Math.round(revisionSavingsTotal * 100) / 100,
    remaining_commitment: plan.status === "active" ? Math.max(orderTotal - recordedTotal, 0) : 0,
    variance,
    variance_percent: variancePercent,
    is_over_budget: recordedTotal > orderTotal + 0.01,
    line_items: lineInsights,
    by_category: byCategory,
    by_fragrance: byFragrance,
    days_until_deadline: daysUntilDeadline,
    is_overdue: isOverdue,
    open_task_count: openTasks.length,
    open_milestone_count: openMilestones.length,
    is_blocked: openMilestones.length > 0,
  }
}

export async function logPlanActivity(
  req: MedusaRequest,
  planId: string,
  action: string,
  actor: string,
  details?: Record<string, unknown>
) {
  const service = getBudgetService(req)
  await service.createPlanActivities([
    { plan_id: planId, action, actor, details: details ?? null },
  ])
}

export async function logTaskActivity(
  req: MedusaRequest,
  taskId: string,
  action: string,
  actor: string,
  details?: Record<string, unknown>
) {
  const service = getBudgetService(req)
  await service.createTaskActivities([
    { task_id: taskId, action, actor, details: details ?? null },
  ])
}

export async function resolveFounderEmail(
  req: MedusaRequest,
  founderName: string
): Promise<string | null> {
  const service = getBudgetService(req)
  const [settings] = await service.listBudgetSettings({}, { take: 1 })
  if (!settings) return null

  const pairs = [
    { name: settings.founder_1_name, email: settings.founder_1_email },
    { name: settings.founder_2_name, email: settings.founder_2_email },
    { name: settings.founder_3_name, email: settings.founder_3_email },
  ]
  const match = pairs.find((row) => row.name.trim() === founderName.trim())
  const email = match?.email?.trim()
  return email && email.includes("@") ? email : null
}

function smtpConfigured() {
  if (process.env.RESEND_API_KEY?.trim()) return true
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function notifyFounderTask(
  req: MedusaRequest,
  options: {
    task: {
      id: string
      title: string
      description?: string | null
      assigned_to: string
      status: string
      priority: string
      due_date?: string | Date | null
      plan_id?: string | null
      is_milestone?: boolean
    }
    event: "created" | "updated"
    actor: string
    changes?: string[]
    force?: boolean
  }
): Promise<void> {
  if (!smtpConfigured()) return

  const { task, event, actor, changes = [], force = false } = options
  if (!force && actor.trim() === task.assigned_to.trim()) return

  const email = await resolveFounderEmail(req, task.assigned_to)
  if (!email) return

  let planTitle: string | null = null
  if (task.plan_id) {
    const service = getBudgetService(req)
    const [plan] = await service.listPlans({ id: task.plan_id }, { take: 1 })
    planTitle = plan?.title ?? null
  }

  try {
    const notificationService = req.scope.resolve<INotificationModuleService>(
      Modules.NOTIFICATION
    )
    await notificationService.createNotifications({
      to: email,
      channel: "email",
      template: event === "created" ? "task-assigned" : "task-updated",
      data: {
        task,
        actor,
        changes,
        plan_title: planTitle,
      },
    })
  } catch (error) {
    console.error("[task-notification] Failed to send email", error)
  }
}

export function buildTaskChangeSummary(
  existing: {
    title: string
    assigned_to: string
    status: string
    priority: string
    due_date?: string | Date | null
    description?: string | null
    plan_id?: string | null
    is_milestone?: boolean
  },
  body: {
    title?: string
    assigned_to?: string
    status?: string
    priority?: string
    due_date?: string | null
    description?: string | null
    plan_id?: string | null
    is_milestone?: boolean
    comment?: string
  }
): string[] {
  const lines: string[] = []

  if (body.title?.trim() && body.title.trim() !== existing.title) {
    lines.push(`Title → ${body.title.trim()}`)
  }
  if (body.assigned_to?.trim() && body.assigned_to.trim() !== existing.assigned_to) {
    lines.push(`Reassigned from ${existing.assigned_to} to ${body.assigned_to.trim()}`)
  }
  if (body.status && body.status !== existing.status) {
    lines.push(`Status: ${existing.status} → ${body.status}`)
  }
  if (body.priority && body.priority !== existing.priority) {
    lines.push(`Priority: ${existing.priority} → ${body.priority}`)
  }
  if (body.due_date !== undefined) {
    const oldDue = existing.due_date ? new Date(existing.due_date).toISOString().slice(0, 10) : null
    const newDue = body.due_date ? new Date(body.due_date).toISOString().slice(0, 10) : null
    if (oldDue !== newDue) {
      lines.push(`Due date: ${oldDue ?? "none"} → ${newDue ?? "none"}`)
    }
  }
  if (body.description !== undefined && body.description !== existing.description) {
    lines.push("Description updated")
  }
  if (body.plan_id !== undefined && body.plan_id !== existing.plan_id) {
    lines.push(body.plan_id ? "Linked to a plan" : "Unlinked from plan")
  }
  if (body.is_milestone !== undefined && body.is_milestone !== existing.is_milestone) {
    lines.push(body.is_milestone ? "Marked as milestone" : "Unmarked as milestone")
  }
  if (body.comment?.trim()) {
    lines.push(`Comment: ${body.comment.trim()}`)
  }

  return lines
}

export async function replacePlanLineItems(
  req: MedusaRequest,
  planId: string,
  items: PlanLineItemInput[]
) {
  const service = getBudgetService(req)
  const existing = await service.listPlanLineItems({ plan_id: planId }, { take: 200 })
  const mapItem = (item: PlanLineItemInput, index: number) => ({
    label: item.label,
    category_id: item.category_id,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    shipping: Number(item.shipping ?? 0),
    sort_order: item.sort_order ?? index,
    notes: item.notes ?? null,
    product_id: item.product_id ?? null,
    variant_id: item.variant_id ?? null,
    planned_fragrance_name: item.planned_fragrance_name?.trim() || null,
  })

  const hasStableIds = items.some((item) => item.id)
  if (!hasStableIds) {
    if (existing.length) {
      await service.deletePlanLineItems(existing.map((i: { id: string }) => i.id))
    }
    if (!items.length) return []
    return service.createPlanLineItems(
      items.map((item, index) => ({
        plan_id: planId,
        ...mapItem(item, index),
      }))
    )
  }

  const existingIds = new Set(existing.map((i: { id: string }) => i.id))
  const incomingIds = new Set(
    items.filter((item) => item.id).map((item) => item.id as string)
  )
  const toDelete = existing.filter((i: { id: string }) => !incomingIds.has(i.id))
  if (toDelete.length) {
    await service.deletePlanLineItems(toDelete.map((i: { id: string }) => i.id))
  }

  const synced: Awaited<ReturnType<typeof service.createPlanLineItems>> = []
  for (const [index, item] of items.entries()) {
    const payload = mapItem(item, index)
    if (item.id && existingIds.has(item.id)) {
      const updated = await service.updatePlanLineItems({ id: item.id, ...payload })
      synced.push(Array.isArray(updated) ? updated[0] : updated)
    } else {
      const created = await service.createPlanLineItems([
        { plan_id: planId, ...payload },
      ])
      synced.push(created[0])
    }
  }

  return synced
}

export function toErrorResponse(error: unknown): { status: number; message: string } {
  if (error instanceof MedusaError) {
    const status =
      error.type === MedusaError.Types.NOT_FOUND
        ? 404
        : error.type === MedusaError.Types.NOT_ALLOWED
          ? 409
          : error.type === MedusaError.Types.INVALID_DATA
            ? 400
            : 500
    return { status, message: error.message }
  }
  if (error instanceof Error) {
    return { status: 400, message: error.message }
  }
  return { status: 500, message: "An unexpected error occurred" }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBudgetService(req: MedusaRequest): any {
  return req.scope.resolve(BUDGET_FINANCE_MODULE)
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function computeCostSheetMetrics(sheet: {
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
}) {
  const cogsPerUnit =
    Number(sheet.fragrance_cost) +
    Number(sheet.alcohol_cost) +
    Number(sheet.bottle_cost) +
    Number(sheet.cap_cost) +
    Number(sheet.label_cost) +
    Number(sheet.box_cost) +
    Number(sheet.filling_cost) +
    Number(sheet.packaging_other)

  const batchQty = Number(sheet.batch_quantity) || 0
  const totalBatchCost = cogsPerUnit * batchQty
  const discount = Number(sheet.avg_discount_percent) || 0
  const retail = Number(sheet.retail_price) || 0
  const effectivePrice = retail * (1 - discount / 100)
  const unitMargin = effectivePrice - cogsPerUnit
  const breakEvenUnits =
    unitMargin > 0 && totalBatchCost > 0 ? Math.ceil(totalBatchCost / unitMargin) : null

  const unitsSold = Number(sheet.units_sold) || 0
  const revenueAtEffective = unitsSold * effectivePrice
  const cogsSold = unitsSold * cogsPerUnit
  const grossProfit = revenueAtEffective - cogsSold
  const inventoryUnits = Math.max(batchQty - unitsSold, 0)
  const inventoryValue = inventoryUnits * cogsPerUnit

  return {
    cogs_per_unit: Math.round(cogsPerUnit),
    total_batch_cost: Math.round(totalBatchCost),
    effective_price: Math.round(effectivePrice),
    unit_margin: Math.round(unitMargin),
    break_even_units: breakEvenUnits,
    units_remaining: inventoryUnits,
    inventory_value: Math.round(inventoryValue),
    gross_profit_to_date: Math.round(grossProfit),
    is_profitable_per_unit: unitMargin > 0,
  }
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`
}

function currentPeriod() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function sumTransactions(
  transactions: Array<{ type: string; amount: number }>,
  types: string[]
) {
  return transactions
    .filter((tx) => types.includes(tx.type))
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
}

/** Positive inflow types credit the pool; negative amounts count as withdrawal. */
function splitFundingTxAmount(
  type: string,
  amount: number
): { contributed: number; withdrawn: number } {
  const n = Number(amount)
  const inflowTypes = ["contribution", "disbursement"]
  const outflowTypes = ["withdrawal", "emi_payment", "interest", "other"]

  if (inflowTypes.includes(type)) {
    return n >= 0
      ? { contributed: n, withdrawn: 0 }
      : { contributed: 0, withdrawn: Math.abs(n) }
  }
  if (outflowTypes.includes(type)) {
    return n >= 0
      ? { contributed: 0, withdrawn: n }
      : { contributed: Math.abs(n), withdrawn: 0 }
  }
  return n >= 0
    ? { contributed: n, withdrawn: 0 }
    : { contributed: 0, withdrawn: Math.abs(n) }
}

function sumFundingPool(
  transactions: Array<{ type: string; amount: number }>
): { contributed: number; withdrawn: number } {
  return transactions.reduce(
    (acc, tx) => {
      const split = splitFundingTxAmount(tx.type, tx.amount)
      acc.contributed += split.contributed
      acc.withdrawn += split.withdrawn
      return acc
    },
    { contributed: 0, withdrawn: 0 }
  )
}

function generateUpcomingEmis(source: {
  emi_amount?: number | null
  disbursement_date?: string | Date | null
  tenure_months?: number | null
  label: string
  id: string
}) {
  const emi = Number(source.emi_amount ?? 0)
  const tenure = Number(source.tenure_months ?? 0)
  const start = source.disbursement_date ? new Date(source.disbursement_date) : null

  if (!emi || !tenure || !start || Number.isNaN(start.getTime())) {
    return []
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming: Array<{
    funding_source_id: string
    label: string
    due_date: string
    amount: number
  }> = []

  for (let i = 0; i < tenure; i += 1) {
    const due = new Date(start)
    due.setMonth(start.getMonth() + i + 1)
    if (due >= today) {
      upcoming.push({
        funding_source_id: source.id,
        label: source.label,
        due_date: due.toISOString(),
        amount: emi,
      })
    }
    if (upcoming.length >= 6) {
      break
    }
  }

  return upcoming
}

async function ensureMaterialCategories(req: MedusaRequest) {
  const service = getBudgetService(req)
  const existing = await service.listExpenseCategories({}, { take: 100 })
  const slugs = new Set(existing.map((c: { slug: string }) => c.slug))
  const toCreate = MATERIAL_CATEGORIES.filter((cat) => !slugs.has(cat.slug))

  if (toCreate.length) {
    await service.createExpenseCategories(
      toCreate.map((cat) => ({
        ...cat,
        is_active: true,
        description: "description" in cat ? cat.description ?? null : null,
      }))
    )
  }

  const oilCategory = existing.find(
    (c: { slug: string }) => c.slug === "fragrance-oil"
  ) ?? (await service.listExpenseCategories({ slug: "fragrance-oil" }, { take: 1 }))?.[0]

  if (oilCategory) {
    const oilMeta = MATERIAL_CATEGORIES.find((c) => c.slug === "fragrance-oil")
    if (oilMeta?.description && oilCategory.description !== oilMeta.description) {
      await service.updateExpenseCategories({
        id: oilCategory.id,
        description: oilMeta.description,
      })
    }
  }

  const legacy = existing.find(
    (c: { slug: string; name: string }) =>
      c.slug === "product-cogs" && c.name === "Product / COGS"
  )
  if (legacy) {
    await service.updateExpenseCategories({
      id: legacy.id,
      name: "Product / COGS (other)",
    })
  }
}

export async function ensureBudgetSetup(req: MedusaRequest) {
  const service = getBudgetService(req)

  let [settings] = await service.listBudgetSettings({}, { take: 1 })
  if (!settings) {
    ;[settings] = await service.createBudgetSettings([
      {
        id: "default",
        founder_1_name: "Founder 1",
        founder_2_name: "Founder 2",
        founder_3_name: "Founder 3",
        default_currency: "inr",
      },
    ])
  }

  let categories = await service.listExpenseCategories(
    {},
    { order: { sort_order: "ASC" }, take: 100 }
  )

  if (!categories.length) {
    categories = await service.createExpenseCategories(
      DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
        ...cat,
        is_active: true,
      }))
    )
  } else {
    await ensureMaterialCategories(req)
    categories = await service.listExpenseCategories(
      {},
      { order: { sort_order: "ASC" }, take: 100 }
    )
  }

  const founderSources = await service.listFundingSources(
    { type: "founder" },
    { take: 10 }
  )
  const existingKeys = new Set(
    founderSources.map((s: { founder_key?: string }) => s.founder_key).filter(Boolean)
  )

  const founderNames: Record<string, string> = {
    founder_1: settings.founder_1_name,
    founder_2: settings.founder_2_name,
    founder_3: settings.founder_3_name,
  }

  for (const key of FOUNDER_KEYS) {
    if (!existingKeys.has(key)) {
      await service.createFundingSources([
        {
          type: "founder",
          founder_key: key,
          label: founderNames[key],
          status: "active",
        },
      ])
    }
  }

  return { settings, categories }
}

export async function getBudgetDashboard(req: MedusaRequest) {
  const service = getBudgetService(req)
  const query = req.scope.resolve("query") as any
  const { settings, categories } = await ensureBudgetSetup(req)
  const { year, month } = currentPeriod()

  const { data: catalogProductsRaw } = await query.graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.title"],
    pagination: { take: 100 },
  })

  const catalogProducts: CatalogProduct[] = (catalogProductsRaw ?? []).map(
    (product: { id: string; title: string; variants?: Array<{ id: string; title: string }> }) => ({
      id: product.id,
      title: product.title,
      variants: (product.variants ?? []).map((variant) => ({
        id: variant.id,
        title: variant.title,
      })),
    })
  )
  const catalog = buildCatalogMaps(catalogProducts)

  const [
    expenses,
    monthlyBudgets,
    cashSnapshots,
    fundingSources,
    fundingTransactions,
    fundingAllocations,
    costSheets,
    businessEvents,
    plans,
    planLineItems,
    planActivities,
    planRevisions,
    founderTasks,
    taskActivities,
    offlineSales,
  ] = await Promise.all([
    service.listExpenses({}, { order: { expense_date: "DESC" }, take: 500 }),
    service.listMonthlyBudgets({}, { take: 500 }),
    service.listCashSnapshots({}, { order: { snapshot_date: "DESC" }, take: 50 }),
    service.listFundingSources({}, { order: { created_at: "ASC" }, take: 100 }),
    service.listFundingTransactions({}, { order: { transaction_date: "DESC" }, take: 500 }),
    service.listFundingAllocations({}, { take: 500 }),
    service.listProductCostSheets({}, { order: { created_at: "DESC" }, take: 100 }),
    service.listBusinessEvents({}, { order: { event_date: "DESC" }, take: 100 }),
    service.listPlans({}, { order: { created_at: "DESC" }, take: 200 }),
    service.listPlanLineItems({}, { take: 1000 }),
    service.listPlanActivities({}, { order: { created_at: "DESC" }, take: 500 }),
    service.listPlanRevisions({}, { order: { created_at: "DESC" }, take: 500 }),
    service.listFounderTasks({}, { order: { created_at: "DESC" }, take: 200 }),
    service.listTaskActivities({}, { order: { created_at: "DESC" }, take: 1000 }),
    listOfflineSales(req),
  ])

  for (const plan of plans.filter((p: { status: string }) => p.status === "completed")) {
    await syncCompletedPlanExpensesIfStale(
      req,
      plan.id,
      (plan as { created_by: string }).created_by
    )
  }

  if (plans.some((p: { status: string }) => p.status === "completed")) {
    const refreshedExpenses = await service.listExpenses(
      {},
      { order: { expense_date: "DESC" }, take: 500 }
    )
    expenses.length = 0
    expenses.push(...refreshedExpenses)
  }

  const categoryMap = new Map<string, { name: string }>(
    categories.map((c: { id: string; name: string; slug: string }) => [
      c.id,
      { name: c.name },
    ])
  )
  const currency = settings.default_currency ?? "inr"

  const activeOffline = offlineSales.filter(
    (sale: { canceled_at?: string | null }) => !sale.canceled_at
  )
  const offlineRevenue = activeOffline.reduce(
    (sum: number, sale: { metadata?: { paid_amount?: number } }) =>
      sum + Number(sale.metadata?.paid_amount ?? 0),
    0
  )

  const now = new Date()
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

  const expensesThisMonth = expenses.filter((e: { expense_date: string }) => {
    const d = new Date(e.expense_date)
    return d >= monthStart && d <= monthEnd
  })

  const totalSpentThisMonth = expensesThisMonth.reduce(
    (sum: number, e: { amount: number }) => sum + Number(e.amount),
    0
  )
  const totalSpentAllTime = expenses.reduce(
    (sum: number, e: { amount: number }) => sum + Number(e.amount),
    0
  )

  const budgetsThisMonth = monthlyBudgets.filter(
    (b: { year: number; month: number }) => b.year === year && b.month === month
  )
  const totalBudgetThisMonth = budgetsThisMonth.reduce(
    (sum: number, b: { amount: number }) => sum + Number(b.amount),
    0
  )

  const budgetVsActual = categories.map(
    (cat: { id: string; name: string; slug: string }) => {
      const budget = budgetsThisMonth.find(
        (b: { category_id: string }) => b.category_id === cat.id
      )
      const spent = expensesThisMonth
        .filter((e: { category_id: string }) => e.category_id === cat.id)
        .reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0)
      const planned = Number(budget?.amount ?? 0)
      return {
        category_id: cat.id,
        category_name: cat.name,
        planned,
        spent,
        remaining: planned - spent,
        percent_used: planned > 0 ? Math.round((spent / planned) * 100) : null,
      }
    }
  )

  const spendByCategory = categories
    .map((cat: { id: string; name: string }) => {
      const spent = expensesThisMonth
        .filter((e: { category_id: string }) => e.category_id === cat.id)
        .reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0)
      return { label: cat.name, value: spent, category_id: cat.id }
    })
    .filter((row: { value: number }) => row.value > 0)
    .sort((a: { value: number }, b: { value: number }) => b.value - a.value)

  const monthlyTrend: Array<{ label: string; expenses: number; revenue: number }> = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59, 999)
    const label = new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "2-digit",
    }).format(start)

    const monthExpenses = expenses
      .filter((e: { expense_date: string }) => {
        const ed = new Date(e.expense_date)
        return ed >= start && ed <= end
      })
      .reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0)

    const monthRevenue = activeOffline
      .filter((sale: { created_at: string }) => {
        const sd = new Date(sale.created_at)
        return sd >= start && sd <= end
      })
      .reduce(
        (sum: number, sale: { metadata?: { paid_amount?: number } }) =>
          sum + Number(sale.metadata?.paid_amount ?? 0),
        0
      )

    monthlyTrend.push({ label, expenses: monthExpenses, revenue: monthRevenue })
  }

  const latestCash = cashSnapshots[0] as
    | { bank_balance: number; cash_in_hand: number; snapshot_date: string }
    | undefined
  const totalCash = latestCash
    ? Number(latestCash.bank_balance) + Number(latestCash.cash_in_hand)
    : null

  const avgMonthlyBurn =
    monthlyTrend.length > 0
      ? Math.round(
          monthlyTrend.reduce((s, row) => s + row.expenses, 0) / monthlyTrend.length
        )
      : 0
  const runwayMonths =
    totalCash != null && avgMonthlyBurn > 0
      ? Math.round((totalCash / avgMonthlyBurn) * 10) / 10
      : null

  const txsBySource = new Map<string, Array<{ type: string; amount: number }>>()
  for (const tx of fundingTransactions) {
    const list = txsBySource.get(tx.funding_source_id) ?? []
    list.push(tx)
    txsBySource.set(tx.funding_source_id, list)
  }

  const expensesBySource = new Map<string, number>()
  for (const expense of expenses) {
    if (!expense.funding_source_id) continue
    expensesBySource.set(
      expense.funding_source_id,
      (expensesBySource.get(expense.funding_source_id) ?? 0) + Number(expense.amount)
    )
  }

  const founderSummaries = fundingSources
    .filter((s: { type: string }) => s.type === "founder")
    .map((source: { id: string; label: string; founder_key?: string }) => {
      const txs = txsBySource.get(source.id) ?? []
      const { contributed, withdrawn: txWithdrawn } = sumFundingPool(txs)
      const spent = expensesBySource.get(source.id) ?? 0
      const withdrawn = txWithdrawn
      const balance = contributed - withdrawn - spent
      return {
        id: source.id,
        founder_key: source.founder_key,
        label: source.label,
        contributed,
        spent,
        withdrawn,
        balance,
      }
    })

  const loanSummaries = fundingSources
    .filter((s: { type: string }) => s.type === "loan")
    .map(
      (loan: {
        id: string
        label: string
        principal_amount?: number
        emi_amount?: number
        tenure_months?: number
        disbursement_date?: string
        interest_rate?: number
        status: string
      }) => {
        const txs = txsBySource.get(loan.id) ?? []
        const disbursed = sumTransactions(txs, ["disbursement", "contribution"])
        const repaid = sumTransactions(txs, ["emi_payment", "interest"])
        const spent = expensesBySource.get(loan.id) ?? 0
        const principal = Number(loan.principal_amount ?? disbursed)
        const outstanding = Math.max(principal - repaid, 0)
        const allocations = fundingAllocations.filter(
          (a: { funding_source_id: string }) => a.funding_source_id === loan.id
        )
        const plannedTotal = allocations.reduce(
          (sum: number, a: { planned_amount: number }) => sum + Number(a.planned_amount),
          0
        )
        const actualByCategory = allocations.map(
          (alloc: { id: string; category_id: string; planned_amount: number }) => {
            const cat = categoryMap.get(alloc.category_id)
            const actual = expenses
              .filter(
                (e: { funding_source_id?: string; category_id: string }) =>
                  e.funding_source_id === loan.id && e.category_id === alloc.category_id
              )
              .reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0)
            return {
              allocation_id: alloc.id,
              category_id: alloc.category_id,
              category_name: cat?.name ?? alloc.category_id,
              planned: Number(alloc.planned_amount),
              actual,
              variance: Number(alloc.planned_amount) - actual,
            }
          }
        )

        return {
          ...loan,
          disbursed,
          repaid,
          spent,
          outstanding,
          plannedTotal,
          use_of_funds: actualByCategory,
          upcoming_emis: generateUpcomingEmis(loan),
        }
      }
    )

  const upcomingEmis = loanSummaries
    .flatMap((loan: { upcoming_emis: unknown[] }) => loan.upcoming_emis)
    .sort(
      (a: { due_date: string }, b: { due_date: string }) =>
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    )
    .slice(0, 8)

  const eventSummaries = businessEvents.map(
    (event: { id: string; name: string; event_date: string; location?: string }) => {
      const eventExpenses = expenses.filter(
        (e: { business_event_id?: string }) => e.business_event_id === event.id
      )
      const spent = eventExpenses.reduce(
        (sum: number, e: { amount: number }) => sum + Number(e.amount),
        0
      )
      const eventDate = new Date(event.event_date)
      const windowStart = new Date(eventDate)
      windowStart.setDate(windowStart.getDate() - 1)
      const windowEnd = new Date(eventDate)
      windowEnd.setDate(windowEnd.getDate() + 2)

      const revenue = activeOffline
        .filter((sale: { created_at: string }) => {
          const sd = new Date(sale.created_at)
          return sd >= windowStart && sd <= windowEnd
        })
        .reduce(
          (sum: number, sale: { metadata?: { paid_amount?: number } }) =>
            sum + Number(sale.metadata?.paid_amount ?? 0),
          0
        )

      return {
        ...event,
        expense_count: eventExpenses.length,
        spent,
        estimated_revenue: revenue,
        roi: spent > 0 ? Math.round(((revenue - spent) / spent) * 100) : null,
      }
    }
  )

  const costSheetsWithMetrics = costSheets.map(
    (sheet: Parameters<typeof computeCostSheetMetrics>[0] & { id: string; name: string; line_type: string }) => ({
      ...sheet,
      metrics: computeCostSheetMetrics(sheet),
    })
  )

  const lineTypeBreakdown = {
    core: costSheetsWithMetrics.filter(
      (s: { line_type: string }) => s.line_type === "core"
    ),
    clone: costSheetsWithMetrics.filter(
      (s: { line_type: string }) => s.line_type === "clone"
    ),
    offline_only: costSheetsWithMetrics.filter(
      (s: { line_type: string }) => s.line_type === "offline_only"
    ),
  }

  const lineItemsByPlan = new Map<string, typeof planLineItems>()
  for (const item of planLineItems) {
    const list = lineItemsByPlan.get(item.plan_id) ?? []
    list.push(item)
    lineItemsByPlan.set(item.plan_id, list)
  }

  const planSummaries = plans.map(
    (plan: {
      id: string
      title: string
      status: string
      deadline?: string | null
      created_by: string
      notes?: string | null
      deferred_notes?: string | null
      funding_source_id?: string | null
      created_at: string
    }) => {
      const items = (lineItemsByPlan.get(plan.id) ?? []).sort(
        (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
      )
      const revisions = planRevisions.filter(
        (r: { plan_id: string }) => r.plan_id === plan.id
      )
      const insights = computePlanInsights(
        plan,
        items,
        expenses,
        categoryMap,
        founderTasks,
        catalog,
        revisions
      )
      return { ...plan, line_items: items, insights, revisions: revisions.filter(
        (r: { revision_type: string }) => r.revision_type !== "deferred"
      ) }
    }
  )

  const planById = new Map(
    planSummaries.map((plan: { id: string }) => [plan.id, plan])
  )
  const revisionsByPlan = new Map<string, typeof planRevisions>()
  for (const revision of planRevisions) {
    const list = revisionsByPlan.get(revision.plan_id) ?? []
    list.push(revision)
    revisionsByPlan.set(revision.plan_id, list)
  }

  const plan_revision_summaries = [...revisionsByPlan.entries()]
    .map(([planId, revisions]) => {
      const plan = planById.get(planId) as
        | { title?: string; status?: string; deferred_notes?: string | null }
        | undefined
      const autoRevisions = revisions.filter(
        (r: { revision_type: string }) => r.revision_type !== "deferred"
      )
      const total_savings = autoRevisions.reduce(
        (sum: number, row: { savings?: number }) => sum + Number(row.savings ?? 0),
        0
      )
      return {
        plan_id: planId,
        plan_title: plan?.title ?? planId,
        plan_status: plan?.status ?? "",
        deferred_notes: plan?.deferred_notes ?? null,
        total_savings: Math.round(total_savings * 100) / 100,
        revisions: autoRevisions,
      }
    })
    .filter(
      (row) =>
        row.total_savings > 0 ||
        row.revisions.length > 0 ||
        Boolean(row.deferred_notes?.trim())
    )
    .sort(
      (a, b) =>
        b.total_savings - a.total_savings ||
        b.revisions.length - a.revisions.length
    )

  const total_revised_worth = plan_revision_summaries.reduce(
    (sum, row) => sum + row.total_savings,
    0
  )

  const activePlans = planSummaries.filter((p: { status: string }) => p.status === "active")
  const totalCommitted = activePlans.reduce(
    (sum: number, p: { insights: { remaining_commitment: number } }) =>
      sum + p.insights.remaining_commitment,
    0
  )
  const availableCash =
    totalCash != null ? Math.round(totalCash - totalCommitted) : null

  const pendingPlans = activePlans
    .filter(
      (p: {
        insights: { is_overdue: boolean; days_until_deadline: number | null }
      }) =>
        p.insights.is_overdue ||
        (p.insights.days_until_deadline != null && p.insights.days_until_deadline <= 14)
    )
    .sort(
      (a: { insights: { days_until_deadline: number | null } }, b: { insights: { days_until_deadline: number | null } }) =>
        (a.insights.days_until_deadline ?? 999) - (b.insights.days_until_deadline ?? 999)
    )

  const tasksWithActivity = founderTasks.map(
    (task: { id: string; plan_id?: string | null; assigned_to: string; status: string; due_date?: string | null; title: string; is_milestone?: boolean }) => {
      const activity = taskActivities.filter((a: { task_id: string }) => a.task_id === task.id)
      let isOverdue = false
      if (task.due_date && task.status !== "done" && task.status !== "cancelled") {
        isOverdue = new Date(task.due_date) < new Date()
      }
      const linkedPlan = task.plan_id
        ? planSummaries.find((p: { id: string }) => p.id === task.plan_id)
        : null
      return { ...task, activity, is_overdue: isOverdue, plan_title: linkedPlan?.title ?? null }
    }
  )

  const founderNameList = [
    settings.founder_1_name,
    settings.founder_2_name,
    settings.founder_3_name,
  ]

  const overdueTasks = tasksWithActivity.filter(
    (t: { is_overdue: boolean; status: string }) =>
      t.is_overdue && t.status !== "done" && t.status !== "cancelled"
  )

  const openTasksByFounder = founderNameList.reduce(
    (acc: Record<string, number>, name: string) => {
      acc[name] = tasksWithActivity.filter(
        (t: { assigned_to: string; status: string }) =>
          t.assigned_to === name && t.status !== "done" && t.status !== "cancelled"
      ).length
      return acc
    },
    {}
  )

  const fragranceSpendMap = new Map<
    string,
    { label: string; planned: number; actual: number }
  >()
  for (const plan of activePlans) {
    for (const row of plan.insights.by_fragrance ?? []) {
      const key = row.label
      const entry = fragranceSpendMap.get(key) ?? {
        label: row.label,
        planned: 0,
        actual: 0,
      }
      entry.planned += row.planned
      entry.actual += row.actual
      fragranceSpendMap.set(key, entry)
    }
  }
  const fragrance_spend_summary = [...fragranceSpendMap.values()].sort(
    (a, b) => b.planned - a.planned
  )

  return {
    settings,
    categories,
    expenses,
    monthly_budgets: monthlyBudgets,
    cash_snapshots: cashSnapshots,
    funding_sources: fundingSources,
    funding_transactions: fundingTransactions,
    funding_allocations: fundingAllocations,
    cost_sheets: costSheetsWithMetrics,
    business_events: businessEvents,
    plans: planSummaries,
    plan_activities: planActivities,
    tasks: tasksWithActivity,
    stats: {
      currency,
      period: { year, month, key: monthKey(year, month) },
      total_spent_this_month: totalSpentThisMonth,
      total_spent_all_time: totalSpentAllTime,
      total_budget_this_month: totalBudgetThisMonth,
      budget_remaining: totalBudgetThisMonth - totalSpentThisMonth,
      offline_revenue_all_time: offlineRevenue,
      net_position_estimate: offlineRevenue - totalSpentAllTime,
      budget_vs_actual: budgetVsActual,
      spend_by_category: spendByCategory,
      monthly_trend: monthlyTrend,
      latest_cash: latestCash ?? null,
      total_cash: totalCash,
      total_committed: totalCommitted,
      available_cash: availableCash,
      avg_monthly_burn: avgMonthlyBurn,
      runway_months: runwayMonths,
      founder_summaries: founderSummaries,
      loan_summaries: loanSummaries,
      upcoming_emis: upcomingEmis,
      event_summaries: eventSummaries,
      line_type_breakdown: lineTypeBreakdown,
      pending_plans: pendingPlans,
      overdue_tasks: overdueTasks,
      open_tasks_by_founder: openTasksByFounder,
      fragrance_spend_summary,
      total_revised_worth,
      plan_revision_count: planRevisions.length,
      plan_revision_summaries,
    },
    catalog_products: catalogProducts,
    payment_methods: PAYMENT_METHODS,
    funding_types: FUNDING_TYPES,
    transaction_types: TRANSACTION_TYPES,
    line_types: LINE_TYPES,
    plan_statuses: PLAN_STATUSES,
    task_statuses: TASK_STATUSES,
    task_priorities: TASK_PRIORITIES,
    founder_options: [
      { key: "founder_1", name: settings.founder_1_name, email: settings.founder_1_email },
      { key: "founder_2", name: settings.founder_2_name, email: settings.founder_2_email },
      { key: "founder_3", name: settings.founder_3_name, email: settings.founder_3_email },
    ],
  }
}

export async function syncFounderFundingLabels(req: MedusaRequest) {
  const service = getBudgetService(req)
  const [settings] = await service.listBudgetSettings({}, { take: 1 })
  if (!settings) return

  const mapping: Record<string, string> = {
    founder_1: settings.founder_1_name,
    founder_2: settings.founder_2_name,
    founder_3: settings.founder_3_name,
  }

  const sources = await service.listFundingSources({ type: "founder" }, { take: 10 })
  for (const source of sources) {
    if (source.founder_key && mapping[source.founder_key]) {
      await service.updateFundingSources({
        id: source.id,
        label: mapping[source.founder_key],
      })
    }
  }
}
