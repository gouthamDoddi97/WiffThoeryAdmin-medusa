import { Button, Heading, Input, Label, toast } from "@medusajs/ui"
import { useMemo, useState } from "react"
import { AttachmentField } from "./attachment-field"
import {
  BudgetDashboardData,
  BudgetPlan,
  CatalogProduct,
  ExpenseCategory,
  fmt,
  formatDate,
  labelFor,
} from "./types"
import { uploadBudgetAttachment } from "./upload"

type LineDraft = {
  key: string
  label: string
  category_id: string
  quantity: string
  unit_price: string
  shipping: string
  product_id: string
  variant_id: string
  planned_fragrance_name: string
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? "Request failed")
  return data as T
}

function defaultCategory(categories: ExpenseCategory[]) {
  return (
    categories.find((c) => c.slug === "fragrance-oil") ??
    categories.find((c) => c.slug === "product-cogs") ??
    categories[0]
  )?.id ?? ""
}

function newLine(categories: ExpenseCategory[]): LineDraft {
  return {
    key: Math.random().toString(36).slice(2),
    label: "",
    category_id: defaultCategory(categories),
    quantity: "1",
    unit_price: "0",
    shipping: "0",
    product_id: "",
    variant_id: "",
    planned_fragrance_name: "",
  }
}

function categorySlug(categories: ExpenseCategory[], categoryId: string) {
  return categories.find((c) => c.id === categoryId)?.slug ?? ""
}

function quantityLabel(categories: ExpenseCategory[], categoryId: string) {
  const slug = categorySlug(categories, categoryId)
  if (slug === "fragrance-oil") return "Qty (kg)"
  if (slug === "bottles-atomizers" || slug === "labels" || slug === "boxes") return "Qty (pcs)"
  return "Qty"
}

function unitPriceLabel(categories: ExpenseCategory[], categoryId: string) {
  const slug = categorySlug(categories, categoryId)
  if (slug === "fragrance-oil") return "₹ / kg"
  return "Unit ₹"
}

function formatLineQuantity(
  categories: ExpenseCategory[],
  categoryId: string,
  quantity: number
) {
  const slug = categorySlug(categories, categoryId)
  if (slug === "fragrance-oil") {
    return `${quantity} kg`
  }
  if (slug === "bottles-atomizers" || slug === "labels" || slug === "boxes") {
    return `${quantity} pcs`
  }
  return String(quantity)
}

function lineDraftTotal(line: LineDraft) {
  return (
    Number(line.quantity || 0) * Number(line.unit_price || 0) +
    Number(line.shipping || 0)
  )
}

function linePayload(line: LineDraft, index: number) {
  return {
    label: line.label.trim(),
    category_id: line.category_id,
    quantity: Number(line.quantity),
    unit_price: Number(line.unit_price),
    shipping: Number(line.shipping || 0),
    sort_order: index,
    product_id: line.product_id || null,
    variant_id: line.product_id && line.variant_id ? line.variant_id : null,
    planned_fragrance_name:
      !line.product_id && line.planned_fragrance_name.trim()
        ? line.planned_fragrance_name.trim()
        : null,
  }
}

function PlanDetail({
  plan,
  currency,
  categories,
  onRefresh,
  currentUser,
}: {
  plan: BudgetPlan
  currency: string
  categories: ExpenseCategory[]
  onRefresh: () => Promise<void>
  currentUser: string
}) {
  const { insights } = plan
  const [uploadingInvoice, setUploadingInvoice] = useState(false)
  const requiresInvoice = insights.planned_total > 0

  const saveInvoice = async (invoiceUrl: string | null) => {
    if (!currentUser) {
      toast.error("Select who you are (top right)")
      return
    }
    await api(`/admin/budget/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_url: invoiceUrl, actor: currentUser }),
    })
    await onRefresh()
  }

  const handleInvoiceUpload = async (file: File) => {
    setUploadingInvoice(true)
    try {
      const url = await uploadBudgetAttachment(file)
      await saveInvoice(url)
      toast.success("Invoice attached")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploadingInvoice(false)
    }
  }

  const completePlan = async () => {
    if (!currentUser) {
      toast.error("Select who you are (top right)")
      return
    }
    if (requiresInvoice && !plan.invoice_url) {
      toast.error("Upload an invoice before marking this plan complete")
      return
    }
    try {
      await api(`/admin/budget/plans/${plan.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: currentUser, invoice_url: plan.invoice_url }),
      })
      toast.success("Plan completed — expenses recorded from line items")
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    }
  }

  const action = async (path: string, label: string) => {
    if (!currentUser) {
      toast.error("Select who you are (top right)")
      return
    }
    try {
      await api(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: currentUser }),
      })
      toast.success(label)
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    }
  }

  return (
    <div className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-subtle flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{plan.title}</p>
          <p className="text-xs text-ui-fg-subtle mt-1">
            {labelFor(
              [
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ],
              plan.status
            )}
            {plan.deadline ? ` · Due ${formatDate(plan.deadline)}` : ""}
            {insights.is_overdue ? " · Overdue" : ""}
            {insights.is_blocked ? " · Blocked by open milestones" : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {plan.status === "draft" && (
            <>
              <Button size="small" onClick={() => action(`/admin/budget/plans/${plan.id}/activate`, "Plan activated")}>
                Activate
              </Button>
              <Button
                size="small"
                variant="danger"
                onClick={async () => {
                  if (!window.confirm("Discard this draft?")) return
                  await api(`/admin/budget/plans/${plan.id}`, { method: "DELETE" })
                  toast.success("Draft discarded")
                  await onRefresh()
                }}
              >
                Discard
              </Button>
            </>
          )}
          {plan.status === "active" && (
            <Button size="small" onClick={completePlan}>
              Mark complete
            </Button>
          )}
          {(plan.status === "draft" || plan.status === "active") && (
            <Button
              size="small"
              variant="secondary"
              onClick={() => action(`/admin/budget/plans/${plan.id}/cancel`, "Plan cancelled")}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {(plan.status === "active" || plan.status === "completed" || plan.invoice_url) && (
        <AttachmentField
          label="Purchase invoice"
          hint={
            requiresInvoice
              ? "Required before marking complete. Completing the plan auto-records expenses from each line item using this invoice."
              : "Optional for plans with no planned amount."
          }
          url={plan.invoice_url}
          uploading={uploadingInvoice}
          required={requiresInvoice && plan.status === "active"}
          readOnly={plan.status === "completed" || plan.status === "cancelled"}
          onUpload={handleInvoiceUpload}
          onClear={
            plan.status === "active"
              ? async () => {
                  await saveInvoice(null)
                  toast.success("Invoice removed")
                }
              : undefined
          }
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-ui-fg-subtle text-xs">Planned</p>
          <p className="font-medium">{fmt(insights.planned_total, currency)}</p>
        </div>
        <div>
          <p className="text-ui-fg-subtle text-xs">Actual</p>
          <p className="font-medium">{fmt(insights.actual_total, currency)}</p>
        </div>
        <div>
          <p className="text-ui-fg-subtle text-xs">Remaining</p>
          <p className="font-medium">{fmt(insights.variance, currency)}</p>
        </div>
        <div>
          <p className="text-ui-fg-subtle text-xs">Committed</p>
          <p className="font-medium">{fmt(insights.remaining_commitment, currency)}</p>
        </div>
      </div>

      {insights.by_fragrance.length > 0 && (
        <div className="border border-ui-border-base rounded-md p-3 bg-ui-bg-base">
          <p className="text-xs font-medium text-ui-fg-subtle mb-2">By fragrance / product</p>
          <div className="flex flex-col gap-1">
            {insights.by_fragrance.map((row) => (
              <div key={row.label} className="flex justify-between text-xs gap-2">
                <span className="truncate">{row.label}</span>
                <span className="text-ui-fg-subtle shrink-0">
                  {fmt(row.actual, currency)} / {fmt(row.planned, currency)} planned
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="text-ui-fg-subtle border-b border-ui-border-base">
              <th className="text-left pb-2 pr-2">Item</th>
              <th className="text-left pb-2 pr-2">For product</th>
              <th className="text-left pb-2 pr-2">Category</th>
              <th className="text-right pb-2 pr-2">Qty</th>
              <th className="text-right pb-2 pr-2">Shipping</th>
              <th className="text-right pb-2 pr-2">Planned</th>
              <th className="text-right pb-2">Actual</th>
            </tr>
          </thead>
          <tbody>
            {insights.line_items.map((item) => (
              <tr key={item.id} className="border-b border-ui-border-base last:border-0">
                <td className="py-2 pr-2">{item.label}</td>
                <td className="py-2 pr-2 text-ui-fg-subtle">{item.fragrance_label ?? "—"}</td>
                <td className="py-2 pr-2 text-ui-fg-subtle">{item.category_name}</td>
                <td className="py-2 pr-2 text-right text-ui-fg-subtle">
                  {formatLineQuantity(categories, item.category_id, item.quantity)}
                  {categorySlug(categories, item.category_id) === "fragrance-oil" && item.unit_price > 0
                    ? ` @ ${fmt(item.unit_price, currency)}/kg`
                    : ""}
                </td>
                <td className="py-2 pr-2 text-right text-ui-fg-subtle">
                  {Number(item.shipping ?? 0) > 0 ? fmt(item.shipping ?? 0, currency) : "—"}
                </td>
                <td className="py-2 pr-2 text-right">{fmt(item.planned ?? 0, currency)}</td>
                <td className="py-2 text-right">{fmt(item.actual ?? 0, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LineItemRow({
  line,
  index,
  categories,
  products,
  currency,
  onChange,
  onRemove,
}: {
  line: LineDraft
  index: number
  categories: ExpenseCategory[]
  products: CatalogProduct[]
  currency: string
  onChange: (index: number, line: LineDraft) => void
  onRemove: (index: number) => void
}) {
  const selectedProduct = products.find((p) => p.id === line.product_id)
  const variants = selectedProduct?.variants ?? []
  const isOil = categorySlug(categories, line.category_id) === "fragrance-oil"
  const oilCategory = categories.find((c) => c.slug === "fragrance-oil")

  return (
    <div className="border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="flex flex-col gap-1 lg:col-span-2">
          <Label className="text-xs">Item description</Label>
          <Input
            placeholder="Oud Maracuja 500ml oil"
            value={line.label}
            onChange={(e) => onChange(index, { ...line, label: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Category</Label>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={line.category_id}
            onChange={(e) => onChange(index, { ...line, category_id: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[5rem]">
            <Label className="text-xs">{quantityLabel(categories, line.category_id)}</Label>
            <Input
              type="number"
              min={0}
              step={isOil ? "0.001" : "0.01"}
              value={line.quantity}
              onChange={(e) => onChange(index, { ...line, quantity: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[5rem]">
            <Label className="text-xs">{unitPriceLabel(categories, line.category_id)}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={line.unit_price}
              onChange={(e) => onChange(index, { ...line, unit_price: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[5rem]">
            <Label className="text-xs">Shipping ₹</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={line.shipping}
              onChange={(e) => onChange(index, { ...line, shipping: e.target.value })}
            />
          </div>
        </div>
      </div>

      {isOil && (
        <p className="text-xs text-ui-fg-subtle -mt-1">
          {oilCategory?.description ?? "1 unit = 1 kg oil — e.g. 5 kg → qty 5, 500 g → qty 0.5"}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Existing product (optional)</Label>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={line.product_id}
            onChange={(e) =>
              onChange(index, {
                ...line,
                product_id: e.target.value,
                variant_id: "",
                planned_fragrance_name: e.target.value ? "" : line.planned_fragrance_name,
              })
            }
          >
            <option value="">— Not in catalog yet —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Variant (optional)</Label>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={line.variant_id}
            disabled={!line.product_id}
            onChange={(e) => onChange(index, { ...line, variant_id: e.target.value })}
          >
            <option value="">Any / whole product</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Planned fragrance name</Label>
          <Input
            placeholder="Bright Crystal clone"
            disabled={Boolean(line.product_id)}
            value={line.planned_fragrance_name}
            onChange={(e) => onChange(index, { ...line, planned_fragrance_name: e.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-ui-fg-subtle">
          {!line.product_id && !line.planned_fragrance_name.trim()
            ? "Shared / unassigned — packaging used across fragrances"
            : line.product_id
              ? "Tagged to catalog product"
              : "Tagged to planned fragrance"}
          {" · "}
          Line total: {fmt(lineDraftTotal(line), currency)}
        </p>
        <Button type="button" variant="secondary" size="small" onClick={() => onRemove(index)}>
          Remove
        </Button>
      </div>
    </div>
  )
}

export function PlansTab({
  data,
  currency,
  currentUser,
  saving,
  setSaving,
  onRefresh,
}: {
  data: BudgetDashboardData
  currency: string
  currentUser: string
  saving: boolean
  setSaving: (v: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [deadline, setDeadline] = useState("")
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine(data.categories)])
  const [filter, setFilter] = useState<"all" | "draft" | "active" | "completed">("all")

  const sortedCategories = useMemo(
    () => [...data.categories].sort((a, b) => a.sort_order - b.sort_order),
    [data.categories]
  )

  const plannedTotal = Math.round(
    lines.reduce((sum, line) => sum + lineDraftTotal(line), 0)
  )

  const categoryBreakdown = sortedCategories
    .map((cat) => ({
      name: cat.name,
      total: lines
        .filter((l) => l.category_id === cat.id)
        .reduce((s, l) => s + lineDraftTotal(l), 0),
    }))
    .filter((row) => row.total > 0)

  const filteredPlans = data.plans.filter((p) => filter === "all" || p.status === filter)

  const updateLine = (index: number, line: LineDraft) => {
    setLines((prev) => prev.map((row, i) => (i === index ? line : row)))
  }

  const saveDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) {
      toast.error("Select who you are (top right)")
      return
    }
    if (!title.trim() || !lines.some((l) => l.label.trim())) {
      toast.error("Title and at least one line item are required")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          created_by: currentUser,
          deadline: deadline || undefined,
          line_items: lines.filter((l) => l.label.trim()).map(linePayload),
        }),
      })
      toast.success("Plan saved as draft")
      setTitle("")
      setDeadline("")
      setLines([newLine(sortedCategories)])
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={saveDraft} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base flex flex-col gap-4">
        <Heading level="h2">New plan</Heading>
        <p className="text-sm text-ui-fg-subtle">
          Tag each line to an existing product, a planned fragrance name, or leave both empty for shared materials (e.g. generic boxes).
          Fragrance oil: enter quantity in <strong>kg</strong> (1 = 1 kg) and unit price as <strong>₹ per kg</strong>.
          Add <strong>shipping ₹</strong> per line when freight is charged separately.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Heading</Label>
            <Input placeholder="Offline perfume oil purchase" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Deadline (optional)</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Line items</Label>
          {lines.map((line, index) => (
            <LineItemRow
              key={line.key}
              line={line}
              index={index}
              categories={sortedCategories}
              products={data.catalog_products ?? []}
              currency={currency}
              onChange={updateLine}
              onRemove={(i) => setLines(lines.filter((_, idx) => idx !== i))}
            />
          ))}
          <Button type="button" variant="secondary" size="small" onClick={() => setLines([...lines, newLine(sortedCategories)])}>
            Add line item
          </Button>
        </div>

        <div className="border border-ui-border-base rounded-md p-3 bg-ui-bg-subtle text-sm flex flex-wrap gap-4">
          <span>Total: <strong>{fmt(plannedTotal, currency)}</strong></span>
          {categoryBreakdown.map((row) => (
            <span key={row.name} className="text-ui-fg-subtle">{row.name}: {fmt(row.total, currency)}</span>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => { setTitle(""); setLines([newLine(sortedCategories)]) }}>
            Clear
          </Button>
          <Button type="submit" isLoading={saving}>Save draft</Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Heading level="h2">Plans</Heading>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        {filteredPlans.length === 0 ? (
          <p className="text-sm text-ui-fg-subtle">No plans yet.</p>
        ) : (
          filteredPlans.map((plan) => (
            <PlanDetail
              key={plan.id}
              plan={plan}
              currency={currency}
              categories={sortedCategories}
              onRefresh={onRefresh}
              currentUser={currentUser}
            />
          ))
        )}
      </div>
    </div>
  )
}
