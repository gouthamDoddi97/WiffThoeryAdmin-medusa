"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Heading, Input, Label, Switch, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

// ── types ────────────────────────────────────────────────────────────────────

type SetItem = {
  product_id: string
  variant_id: string
  product_title: string
  variant_title: string
  thumbnail: string | null
}

type FragranceSet = {
  id: string
  title: string
  description: string | null
  price_amount: number
  currency_code: string
  items: SetItem[]
  is_active: boolean
  badge: string | null
  tags: string | null
  usage_tips: string | null
  ingredients: string | null
  brand_info: string | null
  created_at: string
}

type AdminProduct = {
  id: string
  title: string
  thumbnail: string | null
  variants: { id: string; title: string; images?: { id: string; url: string }[] }[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100)
  } catch {
    return `${currency.toUpperCase()} ${amount / 100}`
  }
}

// ── sub components ────────────────────────────────────────────────────────────

function ItemPicker({
  products,
  items,
  onChange,
}: {
  products: AdminProduct[]
  items: SetItem[]
  onChange: (items: SetItem[]) => void
}) {
  const [selectedProduct, setSelectedProduct] = useState("")
  const [selectedVariant, setSelectedVariant] = useState("")

  const product = products.find((p) => p.id === selectedProduct)

  const addItem = () => {
    if (!product || !selectedVariant) return
    const variant = product.variants.find((v) => v.id === selectedVariant)
    if (!variant) return
    if (items.some((i) => i.variant_id === selectedVariant)) {
      toast.warning("This variant is already in the set")
      return
    }
    onChange([
      ...items,
      {
        product_id: product.id,
        variant_id: variant.id,
        product_title: product.title,
        variant_title: variant.title,
        thumbnail: (variant as any).images?.[0]?.url ?? product.thumbnail,
      },
    ])
    setSelectedProduct("")
    setSelectedVariant("")
  }

  const removeItem = (variantId: string) => {
    onChange(items.filter((i) => i.variant_id !== variantId))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* existing items */}
      {items.length > 0 && (
        <div className="border border-ui-border-base rounded-md divide-y divide-ui-border-base">
          {items.map((item) => (
            <div key={item.variant_id} className="flex items-center gap-3 p-3">
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt={item.product_title}
                  className="w-10 h-10 object-contain rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.product_title}</p>
                <p className="text-xs text-ui-fg-subtle">{item.variant_title}</p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.variant_id)}
                className="text-ui-fg-error text-xs hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* add item row */}
      <div className="flex gap-2 flex-wrap">
        <select
          className="flex-1 min-w-[180px] border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base text-ui-fg-base"
          value={selectedProduct}
          onChange={(e) => {
            setSelectedProduct(e.target.value)
            setSelectedVariant("")
          }}
        >
          <option value="">Select product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <select
          className="flex-1 min-w-[160px] border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base text-ui-fg-base"
          value={selectedVariant}
          onChange={(e) => setSelectedVariant(e.target.value)}
          disabled={!product}
        >
          <option value="">Select variant…</option>
          {product?.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>

        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={addItem}
          disabled={!selectedProduct || !selectedVariant}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

// ── Set form (create / edit) ──────────────────────────────────────────────────

type FormState = {
  title: string
  description: string
  price_amount: string
  currency_code: string
  badge: string
  is_active: boolean
  items: SetItem[]
  tags: string
  usage_tips: string
  ingredients: string
  brand_info: string
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  price_amount: "",
  currency_code: "inr",
  badge: "",
  is_active: true,
  items: [],
  tags: "",
  usage_tips: "",
  ingredients: "",
  brand_info: "",
}

function SetForm({
  initial,
  products,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState
  products: AdminProduct[]
  onSave: (form: FormState) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)

  const set = (k: keyof FormState, v: unknown) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error("Title is required"); return }
    if (!form.price_amount || isNaN(Number(form.price_amount))) {
      toast.error("Enter a valid price"); return
    }
    await onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 border border-ui-border-base rounded-xl bg-ui-bg-subtle">
      <div className="grid grid-cols-1 gap-4 small:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="fs-title">Title *</Label>
          <Input
            id="fs-title"
            placeholder="e.g. Unisex Duo"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="fs-badge">Badge (optional)</Label>
          <Input
            id="fs-badge"
            placeholder="e.g. Best Seller"
            value={form.badge}
            onChange={(e) => set("badge", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="fs-desc">Description</Label>
        <Textarea
          id="fs-desc"
          placeholder="Describe what's in the set…"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="fs-price">
            Price (₹) *
          </Label>
          <Input
            id="fs-price"
            type="number"
            placeholder="e.g. 2999"
            value={form.price_amount}
            onChange={(e) => set("price_amount", e.target.value)}
          />
          {form.price_amount && !isNaN(Number(form.price_amount)) && (
            <span className="text-xs text-ui-fg-subtle">
              = {fmt(Math.round(Number(form.price_amount) * 100), form.currency_code || "inr")}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="fs-currency">Currency code</Label>
          <Input
            id="fs-currency"
            placeholder="inr"
            value={form.currency_code}
            onChange={(e) => set("currency_code", e.target.value.toLowerCase())}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Products in this set</Label>
        <ItemPicker
          products={products}
          items={form.items}
          onChange={(items) => set("items", items)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="fs-tags">Tags <span className="text-ui-fg-subtle font-normal">(comma-separated, e.g. Unisex, Gift, Woody)</span></Label>
        <Input
          id="fs-tags"
          placeholder="Unisex, Gift Set, Woody, Fresh"
          value={form.tags}
          onChange={(e) => set("tags", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="fs-tips">Usage Tips</Label>
        <Textarea
          id="fs-tips"
          placeholder="Apply to pulse points — wrists, neck, inner elbows…"
          value={form.usage_tips}
          onChange={(e) => set("usage_tips", e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="fs-ingr">Ingredients</Label>
        <Textarea
          id="fs-ingr"
          placeholder="Alcohol Denat., Fragrance (Parfum), Aqua…"
          value={form.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="fs-brand">Brand &amp; Manufacturer Info</Label>
        <Textarea
          id="fs-brand"
          placeholder="Manufactured by Whiff Theory, Visakhapatnam, Andhra Pradesh, India…"
          value={form.brand_info}
          onChange={(e) => set("brand_info", e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="fs-active"
          checked={form.is_active}
          onCheckedChange={(v) => set("is_active", v)}
        />
        <Label htmlFor="fs-active">Active (visible in store)</Label>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" isLoading={saving}>
          Save Set
        </Button>
      </div>
    </form>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

const OffersPage = () => {
  const [sets, setSets] = useState<FragranceSet[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<"list" | "create" | { edit: FragranceSet }>("list")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/admin/offers", { credentials: "include" }).then((r) => r.json()),
      fetch("/admin/products?limit=100&fields=id,title,thumbnail,variants.id,variants.title,variants.images", {
        credentials: "include",
      }).then((r) => r.json()),
    ])
      .then(([offerData, productData]) => {
        setSets(offerData.sets ?? [])
        setProducts(productData.products ?? [])
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (form: FormState) => {
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        price_amount: Math.round(Number(form.price_amount) * 100),
        currency_code: form.currency_code || "inr",
        items: form.items,
        is_active: form.is_active,
        badge: form.badge.trim() || null,
        tags: form.tags.trim() || null,
        usage_tips: form.usage_tips.trim() || null,
        ingredients: form.ingredients.trim() || null,
        brand_info: form.brand_info.trim() || null,
      }

      if (typeof mode === "object" && "edit" in mode) {
        // UPDATE
        const res = await fetch(`/admin/offers/${mode.edit.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        const { set } = await res.json()
        setSets((prev) => prev.map((s) => (s.id === set.id ? set : s)))
        toast.success("Set updated")
      } else {
        // CREATE
        const res = await fetch("/admin/offers", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        const { set } = await res.json()
        setSets((prev) => [set, ...prev])
        toast.success("Set created")
      }
      setMode("list")
    } catch {
      toast.error("Failed to save set")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this fragrance set? This cannot be undone.")) return
    setDeleting(id)
    try {
      const res = await fetch(`/admin/offers/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error()
      setSets((prev) => prev.filter((s) => s.id !== id))
      toast.success("Set deleted")
    } catch {
      toast.error("Failed to delete set")
    } finally {
      setDeleting(null)
    }
  }

  const toggleActive = async (set: FragranceSet) => {
    try {
      const res = await fetch(`/admin/offers/${set.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !set.is_active }),
      })
      if (!res.ok) throw new Error()
      const { set: updated } = await res.json()
      setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    } catch {
      toast.error("Failed to toggle set")
    }
  }

  const editFormInitial = (set: FragranceSet): FormState => ({
    title: set.title,
    description: set.description ?? "",
    price_amount: String(set.price_amount / 100),
    currency_code: set.currency_code,
    badge: set.badge ?? "",
    is_active: set.is_active,
    items: set.items,
    tags: set.tags ?? "",
    usage_tips: set.usage_tips ?? "",
    ingredients: set.ingredients ?? "",
    brand_info: set.brand_info ?? "",
  })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <Heading level="h1">Fragrance Sets / Offers</Heading>
        {mode === "list" && (
          <Button onClick={() => setMode("create")}>Create Set</Button>
        )}
      </div>

      {/* Create form */}
      {mode === "create" && (
        <SetForm
          initial={EMPTY_FORM}
          products={products}
          onSave={handleSave}
          onCancel={() => setMode("list")}
          saving={saving}
        />
      )}

      {/* Edit form */}
      {typeof mode === "object" && "edit" in mode && (
        <SetForm
          initial={editFormInitial(mode.edit)}
          products={products}
          onSave={handleSave}
          onCancel={() => setMode("list")}
          saving={saving}
        />
      )}

      {/* List */}
      {mode === "list" && (
        <>
          {loading && <p className="text-ui-fg-subtle text-sm">Loading…</p>}
          {!loading && sets.length === 0 && (
            <p className="text-ui-fg-subtle text-sm">
              No fragrance sets yet. Create one to show offers on the home page.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {sets.map((set) => (
              <div
                key={set.id}
                className="border border-ui-border-base rounded-xl p-4 flex flex-col gap-3 bg-ui-bg-base"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{set.title}</span>
                      {set.badge && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-ui-tag-orange-bg text-ui-tag-orange-text rounded">
                          {set.badge}
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          set.is_active
                            ? "bg-ui-tag-green-bg text-ui-tag-green-text"
                            : "bg-ui-tag-neutral-bg text-ui-tag-neutral-text"
                        }`}
                      >
                        {set.is_active ? "active" : "inactive"}
                      </span>
                    </div>
                    {set.description && (
                      <p className="text-xs text-ui-fg-subtle line-clamp-2">{set.description}</p>
                    )}
                    <p className="text-sm font-medium mt-1">
                      {fmt(set.price_amount, set.currency_code)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => toggleActive(set)}
                    >
                      {set.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setMode({ edit: set })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      isLoading={deleting === set.id}
                      onClick={() => handleDelete(set.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Items */}
                {set.items.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-ui-border-base">
                    {set.items.map((item) => (
                      <div
                        key={item.variant_id}
                        className="flex items-center gap-2 text-xs border border-ui-border-base rounded-lg px-2 py-1.5"
                      >
                        {item.thumbnail && (
                          <img
                            src={item.thumbnail}
                            alt={item.product_title}
                            className="w-7 h-7 object-contain rounded"
                          />
                        )}
                        <span className="text-ui-fg-base">{item.product_title}</span>
                        <span className="text-ui-fg-subtle">·</span>
                        <span className="text-ui-fg-subtle">{item.variant_title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Fragrance Sets",
})

export default OffersPage
