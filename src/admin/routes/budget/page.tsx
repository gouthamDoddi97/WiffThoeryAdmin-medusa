"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import { Button, Heading, Input, Label, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BudgetDashboardView } from "./dashboard"
import { PlansTab } from "./plans-tab"
import { TasksTab } from "./tasks-tab"
import {
  BudgetDashboardData,
  BudgetTab,
  CURRENT_USER_KEY,
  Expense,
  fmt,
  formatDate,
  labelFor,
} from "./types"

const TABS: { id: BudgetTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "plans", label: "Purchase plans" },
  { id: "tasks", label: "Tasks" },
  { id: "expenses", label: "Expenses" },
  { id: "budgets", label: "Budgets" },
  { id: "funding", label: "Funding" },
  { id: "cost-sheets", label: "Cost sheets" },
  { id: "events", label: "Events" },
  { id: "settings", label: "Settings" },
]

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message ?? "Request failed")
  }
  return data as T
}

const BudgetPage = () => {
  const [data, setData] = useState<BudgetDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<BudgetTab>("dashboard")
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState("")

  const load = useCallback(async () => {
    const dashboard = await api<BudgetDashboardData>("/admin/budget")
    setData(dashboard)
    return dashboard
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(CURRENT_USER_KEY)
    if (saved) setCurrentUser(saved)
    load()
      .catch(() => toast.error("Failed to load budget data"))
      .finally(() => setLoading(false))
  }, [load])

  const currency = data?.stats.currency ?? "inr"
  const founderNames = useMemo(
    () => data?.founder_options.map((f) => f.name) ?? [],
    [data]
  )

  const categoryName = (id: string) =>
    data?.categories.find((c) => c.id === id)?.name ?? id

  const fundingLabel = (id?: string | null) =>
    data?.funding_sources.find((f) => f.id === id)?.label ?? "—"

  const planLabel = (id?: string | null) =>
    data?.plans.find((p) => p.id === id)?.title ?? "—"

  const refresh = async () => {
    await load()
  }

  const saveCurrentUser = (name: string) => {
    setCurrentUser(name)
    localStorage.setItem(CURRENT_USER_KEY, name)
  }

  if (loading || !data) {
    return (
      <div className="p-8">
        <p className="text-ui-fg-subtle text-sm">Loading budget & spending…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Heading level="h1">Budget & Spending</Heading>
          <p className="text-ui-fg-subtle text-sm mt-1">
            Track expenses, founder contributions, loans, and unit economics for Whiff Theory.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Label htmlFor="current-user" className="text-xs whitespace-nowrap">
            Logging in as
          </Label>
          <select
            id="current-user"
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={currentUser}
            onChange={(e) => saveCurrentUser(e.target.value)}
          >
            <option value="">Select founder…</option>
            {founderNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-ui-border-base pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              tab === t.id
                ? "bg-ui-bg-base border border-ui-border-base font-medium"
                : "text-ui-fg-subtle hover:text-ui-fg-base"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <BudgetDashboardView stats={data.stats} />}

      {tab === "plans" && (
        <PlansTab
          data={data}
          currency={currency}
          currentUser={currentUser}
          saving={saving}
          setSaving={setSaving}
          onRefresh={refresh}
        />
      )}

      {tab === "tasks" && (
        <TasksTab
          data={data}
          currentUser={currentUser}
          saving={saving}
          setSaving={setSaving}
          onRefresh={refresh}
        />
      )}

      {tab === "expenses" && (
        <ExpensesTab
          data={data}
          currency={currency}
          currentUser={currentUser}
          categoryName={categoryName}
          fundingLabel={fundingLabel}
          planLabel={planLabel}
          saving={saving}
          setSaving={setSaving}
          onRefresh={refresh}
        />
      )}

      {tab === "budgets" && (
        <BudgetsTab
          data={data}
          currency={currency}
          saving={saving}
          setSaving={setSaving}
          onRefresh={refresh}
        />
      )}

      {tab === "funding" && (
        <FundingTab
          data={data}
          currency={currency}
          currentUser={currentUser}
          saving={saving}
          setSaving={setSaving}
          onRefresh={refresh}
        />
      )}

      {tab === "cost-sheets" && (
        <CostSheetsTab
          data={data}
          currency={currency}
          saving={saving}
          setSaving={setSaving}
          onRefresh={refresh}
        />
      )}

      {tab === "events" && (
        <EventsTab
          data={data}
          currency={currency}
          saving={saving}
          setSaving={setSaving}
          onRefresh={refresh}
        />
      )}

      {tab === "settings" && (
        <SettingsTab
          data={data}
          currentUser={currentUser}
          saving={saving}
          setSaving={setSaving}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}

function ExpensesTab({
  data,
  currency,
  currentUser,
  categoryName,
  fundingLabel,
  planLabel,
  saving,
  setSaving,
  onRefresh,
}: {
  data: BudgetDashboardData
  currency: string
  currentUser: string
  categoryName: (id: string) => string
  fundingLabel: (id?: string | null) => string
  planLabel: (id?: string | null) => string
  saving: boolean
  setSaving: (v: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category_id: data.categories[0]?.id ?? "",
    vendor: "",
    payment_method: "upi",
    funding_source_id: "",
    business_event_id: "",
    plan_id: "",
    plan_line_item_id: "",
    expense_date: new Date().toISOString().slice(0, 10),
    notes: "",
  })

  const activePlans = data.plans.filter((p) => p.status === "active")
  const selectedPlan = activePlans.find((p) => p.id === form.plan_id)
  const planLineOptions = selectedPlan?.line_items ?? []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) {
      toast.error("Select who you are (top right)")
      return
    }
    if (!form.description.trim()) {
      toast.error("Description is required")
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          funding_source_id: form.funding_source_id || undefined,
          business_event_id: form.business_event_id || undefined,
          plan_id: form.plan_id || undefined,
          plan_line_item_id: form.plan_line_item_id || undefined,
          recorded_by: currentUser,
        }),
      })
      toast.success("Expense recorded")
      setForm((f) => ({ ...f, description: "", amount: "", vendor: "", notes: "" }))
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (expense: Expense) => {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return
    setSaving(true)
    try {
      await api(`/admin/budget/expenses/${expense.id}`, { method: "DELETE" })
      toast.success("Deleted")
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={submit} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Heading level="h2">Add expense</Heading>
          <p className="text-xs text-ui-fg-subtle mt-1">
            Purchase plans record expenses automatically when you mark them complete (with invoice).
            Use this form for other spend — ads, subscriptions, ops, etc.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Description</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Amount ({currency.toUpperCase()})</Label>
          <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Category</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Date</Label>
          <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Paid from (founder / loan)</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={form.funding_source_id} onChange={(e) => setForm({ ...form, funding_source_id: e.target.value })}>
            <option value="">Unassigned</option>
            {data.funding_sources.map((f) => (
              <option key={f.id} value={f.id}>{f.label} ({f.type})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Plan (optional)</Label>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={form.plan_id}
            onChange={(e) => setForm({ ...form, plan_id: e.target.value, plan_line_item_id: "" })}
          >
            <option value="">None</option>
            {activePlans.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Plan line item</Label>
          <select
            className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
            value={form.plan_line_item_id}
            disabled={!form.plan_id}
            onChange={(e) => setForm({ ...form, plan_line_item_id: e.target.value })}
          >
            <option value="">Whole plan / unallocated</option>
            {planLineOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Event (optional)</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={form.business_event_id} onChange={(e) => setForm({ ...form, business_event_id: e.target.value })}>
            <option value="">None</option>
            {data.business_events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Payment method</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            {data.payment_methods.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Vendor</Label>
          <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" isLoading={saving}>Add expense</Button>
        </div>
      </form>

      <div className="border border-ui-border-base rounded-xl overflow-hidden bg-ui-bg-base">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ui-fg-subtle bg-ui-bg-subtle border-b border-ui-border-base">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Paid from</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-ui-border-base last:border-0">
                <td className="px-4 py-3 text-ui-fg-subtle whitespace-nowrap">{formatDate(expense.expense_date)}</td>
                <td className="px-4 py-3">{expense.description}</td>
                <td className="px-4 py-3">{categoryName(expense.category_id)}</td>
                <td className="px-4 py-3 text-ui-fg-subtle">{fundingLabel(expense.funding_source_id)}</td>
                <td className="px-4 py-3 text-ui-fg-subtle">{planLabel(expense.plan_id)}</td>
                <td className="px-4 py-3 text-ui-fg-subtle">{expense.recorded_by}</td>
                <td className="px-4 py-3 text-right font-medium">{fmt(Number(expense.amount), currency)}</td>
                <td className="px-4 py-3">
                  <Button size="small" variant="danger" disabled={saving} onClick={() => remove(expense)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BudgetsTab({
  data,
  currency,
  saving,
  setSaving,
  onRefresh,
}: {
  data: BudgetDashboardData
  currency: string
  saving: boolean
  setSaving: (v: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const { year, month } = data.stats.period
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [cashForm, setCashForm] = useState({ bank_balance: "", cash_in_hand: "0", recorded_by: "" })

  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const cat of data.categories) {
      const budget = data.monthly_budgets.find(
        (b) => b.category_id === cat.id && b.year === year && b.month === month
      )
      initial[cat.id] = budget ? String(budget.amount) : ""
    }
    setAmounts(initial)
  }, [data, year, month])

  const saveBudgets = async () => {
    setSaving(true)
    try {
      for (const cat of data.categories) {
        const value = amounts[cat.id]
        const existing = data.monthly_budgets.find(
          (b) => b.category_id === cat.id && b.year === year && b.month === month
        )
        if (!value) {
          if (existing) {
            await api(`/admin/budget/monthly-budgets/${existing.id}`, { method: "DELETE" })
          }
          continue
        }
        const amount = Number(value)
        if (existing) {
          await api(`/admin/budget/monthly-budgets/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
          })
        } else if (amount > 0) {
          await api("/admin/budget/monthly-budgets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: cat.id, year, month, amount }),
          })
        }
      }
      toast.success("Budgets saved")
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  const saveCash = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashForm.recorded_by.trim()) {
      toast.error("Enter your name")
      return
    }
    if (cashForm.bank_balance === "" || Number.isNaN(Number(cashForm.bank_balance))) {
      toast.error("Enter a bank balance")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_balance: Number(cashForm.bank_balance),
          cash_in_hand: Number(cashForm.cash_in_hand),
          recorded_by: cashForm.recorded_by,
        }),
      })
      toast.success("Cash snapshot saved")
      setCashForm({ bank_balance: "", cash_in_hand: "0", recorded_by: cashForm.recorded_by })
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base flex flex-col gap-4">
        <Heading level="h2">Monthly budgets</Heading>
        <p className="text-xs text-ui-fg-subtle">
          {new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}
        </p>
        {data.categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between gap-3">
            <Label className="flex-1">{cat.name}</Label>
            <Input
              type="number"
              min={0}
              className="w-32"
              placeholder="0"
              value={amounts[cat.id] ?? ""}
              onChange={(e) => setAmounts({ ...amounts, [cat.id]: e.target.value })}
            />
          </div>
        ))}
        <Button onClick={saveBudgets} isLoading={saving}>Save budgets</Button>
      </div>

      <div className="flex flex-col gap-4">
        <form noValidate onSubmit={saveCash} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base flex flex-col gap-3">
          <Heading level="h2">Bank reality check (optional)</Heading>
          <p className="text-xs text-ui-fg-subtle">
            Dashboard totals come from <strong>Funding</strong> pools (contributions − withdrawals − tagged spend).
            Use this only to compare your actual bank + petty cash against that total.
          </p>
          <div className="flex flex-col gap-1">
            <Label>Bank balance</Label>
            <Input type="number" value={cashForm.bank_balance} onChange={(e) => setCashForm({ ...cashForm, bank_balance: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Cash in hand</Label>
            <Input type="number" value={cashForm.cash_in_hand} onChange={(e) => setCashForm({ ...cashForm, cash_in_hand: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Recorded by</Label>
            <Input value={cashForm.recorded_by} onChange={(e) => setCashForm({ ...cashForm, recorded_by: e.target.value })} />
          </div>
          <Button type="submit" isLoading={saving}>Save bank check</Button>
        </form>

        {data.cash_snapshots[0] && (
          <div className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-subtle text-sm">
            <p className="font-medium">Latest bank check</p>
            <p className="text-ui-fg-subtle mt-1">
              {formatDate(data.cash_snapshots[0].snapshot_date)} ·{" "}
              {fmt(Number(data.cash_snapshots[0].bank_balance) + Number(data.cash_snapshots[0].cash_in_hand), currency)}
            </p>
            <p className="text-xs text-ui-fg-muted mt-1">
              Funding total on dashboard: {fmt(data.stats.total_cash, currency)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function FundingTab({
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
  const [txForm, setTxForm] = useState({
    funding_source_id: data.funding_sources[0]?.id ?? "",
    type: "contribution",
    amount: "",
    notes: "",
  })
  const [loanForm, setLoanForm] = useState({
    label: "",
    principal_amount: "",
    interest_rate: "",
    tenure_months: "",
    emi_amount: "",
    disbursement_date: "",
    use_of_funds_notes: "",
  })

  const addTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) {
      toast.error("Select who you are (top right)")
      return
    }
    const amount = Number(txForm.amount)
    if (!txForm.amount || !Number.isFinite(amount) || amount === 0) {
      toast.error("Enter a non-zero amount (use negative for withdrawal)")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/funding/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...txForm,
          amount,
          recorded_by: currentUser,
        }),
      })
      toast.success("Transaction recorded")
      setTxForm({ ...txForm, amount: "", notes: "" })
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  const addLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loanForm.label.trim()) {
      toast.error("Loan name is required")
      return
    }
    if (!loanForm.principal_amount || Number(loanForm.principal_amount) <= 0) {
      toast.error("Enter a valid principal amount")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/funding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "loan",
          label: loanForm.label,
          principal_amount: Number(loanForm.principal_amount),
          interest_rate: Number(loanForm.interest_rate),
          tenure_months: Number(loanForm.tenure_months),
          emi_amount: Number(loanForm.emi_amount),
          disbursement_date: loanForm.disbursement_date || undefined,
          use_of_funds_notes: loanForm.use_of_funds_notes || undefined,
          status: "active",
        }),
      })
      toast.success("Loan added")
      setLoanForm({
        label: "",
        principal_amount: "",
        interest_rate: "",
        tenure_months: "",
        emi_amount: "",
        disbursement_date: "",
        use_of_funds_notes: "",
      })
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.stats.founder_summaries.map((f) => (
          <div key={f.id} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base">
            <p className="font-semibold">{f.label}</p>
            <p className="text-xs text-ui-fg-subtle mt-2">Contributed</p>
            <p className="text-lg">{fmt(f.contributed, currency)}</p>
            {f.withdrawn > 0 && (
              <>
                <p className="text-xs text-ui-fg-subtle mt-2">Withdrawn</p>
                <p>{fmt(f.withdrawn, currency)}</p>
              </>
            )}
            <p className="text-xs text-ui-fg-subtle mt-2">Spent (tagged)</p>
            <p>{fmt(f.spent, currency)}</p>
            <p className="text-xs text-ui-fg-subtle mt-2">Pool balance</p>
            <p className={`font-medium ${f.balance < 0 ? "text-red-500" : ""}`}>{fmt(f.balance, currency)}</p>
          </div>
        ))}
      </div>

      <form noValidate onSubmit={addTransaction} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><Heading level="h2">Record contribution, withdrawal, or repayment</Heading></div>
        <div className="flex flex-col gap-1">
          <Label>Pool</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={txForm.funding_source_id} onChange={(e) => setTxForm({ ...txForm, funding_source_id: e.target.value })}>
            {data.funding_sources.map((f) => (
              <option key={f.id} value={f.id}>{f.label} ({f.type})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Type</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}>
            {data.transaction_types.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Amount</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="Negative = withdrawal from pool"
            value={txForm.amount}
            onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
          />
          <p className="text-xs text-ui-fg-subtle">
            Enter a negative amount on Contribution to record a founder withdrawal, or pick Withdrawal and enter a positive amount.
          </p>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" isLoading={saving}>Record</Button>
        </div>
      </form>

      <form noValidate onSubmit={addLoan} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><Heading level="h2">Add loan</Heading></div>
        <div className="flex flex-col gap-1">
          <Label>Loan name</Label>
          <Input value={loanForm.label} onChange={(e) => setLoanForm({ ...loanForm, label: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Principal</Label>
          <Input type="number" value={loanForm.principal_amount} onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Interest rate (% p.a.)</Label>
          <Input type="number" value={loanForm.interest_rate} onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Tenure (months)</Label>
          <Input type="number" value={loanForm.tenure_months} onChange={(e) => setLoanForm({ ...loanForm, tenure_months: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>EMI amount</Label>
          <Input type="number" value={loanForm.emi_amount} onChange={(e) => setLoanForm({ ...loanForm, emi_amount: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Disbursement date</Label>
          <Input type="date" value={loanForm.disbursement_date} onChange={(e) => setLoanForm({ ...loanForm, disbursement_date: e.target.value })} />
        </div>
        <div className="md:col-span-2 flex flex-col gap-1">
          <Label>Planned use of funds</Label>
          <Input value={loanForm.use_of_funds_notes} onChange={(e) => setLoanForm({ ...loanForm, use_of_funds_notes: e.target.value })} placeholder="e.g. 60% inventory, 25% marketing" />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" isLoading={saving}>Add loan</Button>
        </div>
      </form>

      {data.stats.loan_summaries.length > 0 && (
        <div className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base">
          <Heading level="h2">Loans</Heading>
          <div className="mt-4 flex flex-col gap-4">
            {data.stats.loan_summaries.map((loan) => (
              <div key={String(loan.id)} className="border-b border-ui-border-base pb-4 last:border-0">
                <p className="font-semibold">{String(loan.label)}</p>
                <p className="text-sm text-ui-fg-subtle mt-1">
                  Outstanding {fmt(Number(loan.outstanding ?? 0), currency)} · Repaid {fmt(Number(loan.repaid ?? 0), currency)} · Spent {fmt(Number(loan.spent ?? 0), currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CostSheetsTab({
  data,
  currency,
  saving,
  setSaving,
  onRefresh,
}: {
  data: BudgetDashboardData
  currency: string
  saving: boolean
  setSaving: (v: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const [form, setForm] = useState({
    name: "",
    line_type: "core",
    fragrance_cost: "0",
    alcohol_cost: "0",
    bottle_cost: "0",
    cap_cost: "0",
    label_cost: "0",
    box_cost: "0",
    filling_cost: "0",
    packaging_other: "0",
    batch_quantity: "0",
    units_sold: "0",
    retail_price: "0",
    avg_discount_percent: "0",
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/cost-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(form).map(([k, v]) => [
              k,
              ["name", "line_type"].includes(k) ? v : Number(v),
            ])
          )
        ),
      })
      toast.success("Cost sheet created")
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={submit} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base grid md:grid-cols-3 gap-4">
        <div className="md:col-span-3"><Heading level="h2">New SKU / batch cost sheet</Heading></div>
        <div className="flex flex-col gap-1">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Line type</Label>
          <select className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base" value={form.line_type} onChange={(e) => setForm({ ...form, line_type: e.target.value })}>
            {data.line_types.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Batch qty</Label>
          <Input type="number" value={form.batch_quantity} onChange={(e) => setForm({ ...form, batch_quantity: e.target.value })} />
        </div>
        {(["fragrance_cost", "alcohol_cost", "bottle_cost", "cap_cost", "label_cost", "box_cost", "filling_cost", "packaging_other"] as const).map((field) => (
          <div key={field} className="flex flex-col gap-1">
            <Label>{field.replace(/_/g, " ")}</Label>
            <Input type="number" min={0} step="0.01" value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <Label>Retail price</Label>
          <Input type="number" min={0} step="0.01" value={form.retail_price} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Avg discount %</Label>
          <Input type="number" value={form.avg_discount_percent} onChange={(e) => setForm({ ...form, avg_discount_percent: e.target.value })} />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <Button type="submit" isLoading={saving}>Create</Button>
        </div>
      </form>

      <div className="border border-ui-border-base rounded-xl overflow-hidden bg-ui-bg-base">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ui-fg-subtle bg-ui-bg-subtle border-b border-ui-border-base">
              <th className="px-4 py-3">SKU / batch</th>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3 text-right">COGS/unit</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3 text-right">Break-even</th>
              <th className="px-4 py-3 text-right">Stock value</th>
            </tr>
          </thead>
          <tbody>
            {data.cost_sheets.map((sheet) => (
              <tr key={sheet.id} className="border-b border-ui-border-base last:border-0">
                <td className="px-4 py-3 font-medium">{sheet.name}</td>
                <td className="px-4 py-3">{labelFor(data.line_types, sheet.line_type)}</td>
                <td className="px-4 py-3 text-right">{fmt(sheet.metrics?.cogs_per_unit ?? 0, currency)}</td>
                <td className="px-4 py-3 text-right">{fmt(sheet.metrics?.unit_margin ?? 0, currency)}</td>
                <td className="px-4 py-3 text-right">{sheet.metrics?.break_even_units ?? "—"}</td>
                <td className="px-4 py-3 text-right">{fmt(sheet.metrics?.inventory_value ?? 0, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EventsTab({
  data,
  currency,
  saving,
  setSaving,
  onRefresh,
}: {
  data: BudgetDashboardData
  currency: string
  saving: boolean
  setSaving: (v: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const [form, setForm] = useState({ name: "", event_date: new Date().toISOString().slice(0, 10), location: "" })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Event name is required")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      toast.success("Event created")
      setForm({ name: "", event_date: new Date().toISOString().slice(0, 10), location: "" })
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={submit} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base grid md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <Label>Event name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sunday market pop-up" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Date</Label>
          <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Location</Label>
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <Button type="submit" isLoading={saving}>Add event</Button>
        </div>
      </form>

      <div className="border border-ui-border-base rounded-xl overflow-hidden bg-ui-bg-base">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ui-fg-subtle bg-ui-bg-subtle border-b border-ui-border-base">
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Spend</th>
              <th className="px-4 py-3 text-right">Est. revenue</th>
              <th className="px-4 py-3 text-right">ROI</th>
            </tr>
          </thead>
          <tbody>
            {data.stats.event_summaries.map((ev) => (
              <tr key={String(ev.id)} className="border-b border-ui-border-base last:border-0">
                <td className="px-4 py-3 font-medium">{String(ev.name)}</td>
                <td className="px-4 py-3">{formatDate(String(ev.event_date))}</td>
                <td className="px-4 py-3 text-right">{fmt(Number(ev.spent ?? 0), currency)}</td>
                <td className="px-4 py-3 text-right">{fmt(Number(ev.estimated_revenue ?? 0), currency)}</td>
                <td className="px-4 py-3 text-right">{ev.roi != null ? `${ev.roi}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SettingsTab({
  data,
  saving,
  setSaving,
  onRefresh,
}: {
  data: BudgetDashboardData
  currentUser: string
  saving: boolean
  setSaving: (v: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const [form, setForm] = useState({
    founder_1_name: data.settings.founder_1_name,
    founder_2_name: data.settings.founder_2_name,
    founder_3_name: data.settings.founder_3_name,
    founder_1_email: data.settings.founder_1_email ?? "",
    founder_2_email: data.settings.founder_2_email ?? "",
    founder_3_email: data.settings.founder_3_email ?? "",
  })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !form.founder_1_name.trim() ||
      !form.founder_2_name.trim() ||
      !form.founder_3_name.trim()
    ) {
      toast.error("All founder names are required")
      return
    }
    setSaving(true)
    try {
      await api("/admin/budget/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          founder_1_email: form.founder_1_email.trim() || null,
          founder_2_email: form.founder_2_email.trim() || null,
          founder_3_email: form.founder_3_email.trim() || null,
        }),
      })
      toast.success("Founder settings updated")
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={save} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-base max-w-lg flex flex-col gap-4">
      <Heading level="h2">Founder names &amp; emails</Heading>
      <p className="text-sm text-ui-fg-subtle">
        Names appear on funding pools, expense logs, and the &quot;logging in as&quot; selector.
        Add each founder&apos;s email to receive task assignment and update notifications via Gmail SMTP.
      </p>
      {(["founder_1", "founder_2", "founder_3"] as const).map((key, i) => (
        <div key={key} className="grid gap-3 border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle">
          <p className="text-xs font-medium text-ui-fg-subtle">Founder {i + 1}</p>
          <div className="flex flex-col gap-1">
            <Label>Name</Label>
            <Input
              value={form[`${key}_name`]}
              onChange={(e) => setForm({ ...form, [`${key}_name`]: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Email (for task notifications)</Label>
            <Input
              type="email"
              placeholder="founder@example.com"
              value={form[`${key}_email`]}
              onChange={(e) => setForm({ ...form, [`${key}_email`]: e.target.value })}
            />
          </div>
        </div>
      ))}
      <Button type="submit" isLoading={saving}>Save</Button>
    </form>
  )
}

export const config = defineRouteConfig({
  label: "Budget & Spending",
  icon: CurrencyDollar,
})

export default BudgetPage
