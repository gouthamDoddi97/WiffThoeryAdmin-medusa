"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import { Button, Heading, Input, Label, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { computeOfflineSaleStats } from "./analytics"
import { OfflineSalesDashboard } from "./dashboard"

// ── types ────────────────────────────────────────────────────────────────────

type StockLocation = {
  id: string
  name: string
  address?: { city?: string; country_code?: string }
}

type Region = {
  id: string
  name: string
  currency_code: string
}

type VariantPrice = {
  amount: number
  currency_code: string
}

type AdminVariant = {
  id: string
  title: string
  prices?: VariantPrice[]
}

type AdminProduct = {
  id: string
  title: string
  thumbnail: string | null
  variants: AdminVariant[]
}

type SaleLineItem = {
  key: string
  product_id: string
  product_title: string
  variant_id: string
  variant_title: string
  title: string
  quantity: number
  unit_price: number
}

type OfflineSale = {
  id: string
  display_id: number
  email?: string | null
  currency_code: string
  status: string
  created_at: string
  canceled_at?: string | null
  region_id?: string
  metadata?: {
    customer_name?: string
    seller_name?: string
    payment_method?: string
    stock_location_id?: string
    customer_phone?: string
    original_total?: number
    paid_amount?: number
    discount_applied?: number
  }
  items?: {
    id: string
    title: string
    quantity: number
    unit_price: number
    variant_id?: string
    product_id?: string
    product_title?: string
    variant_title?: string
    metadata?: { stock_location_id?: string }
  }[]
}

type PageMode = "list" | "create" | { view: OfflineSale } | { edit: OfflineSale }

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
]

const OTHER_SELLER = "__other__"
const LAST_SELLER_KEY = "offline_sales_last_seller"

// ── helpers ──────────────────────────────────────────────────────────────────

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

function parseMoneyInput(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return Math.round(parsed)
}

function paymentLabel(value?: string) {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value ?? "—"
}

function resolveSellerName(choice: string, custom: string) {
  return choice === OTHER_SELLER ? custom.trim() : choice.trim()
}

function resolveSellerChoice(
  sellerName: string,
  founderNames: string[]
): { choice: string; custom: string } {
  const trimmed = sellerName.trim()
  if (!trimmed) {
    return { choice: founderNames[0] ?? OTHER_SELLER, custom: "" }
  }
  if (founderNames.includes(trimmed)) {
    return { choice: trimmed, custom: "" }
  }
  return { choice: OTHER_SELLER, custom: trimmed }
}

function SellerField({
  founderNames,
  customSellerNames,
  sellerChoice,
  sellerCustom,
  onSellerChoiceChange,
  onSellerCustomChange,
  readOnly,
  sellerName,
}: {
  founderNames: string[]
  customSellerNames: string[]
  sellerChoice: string
  sellerCustom: string
  onSellerChoiceChange: (value: string) => void
  onSellerCustomChange: (value: string) => void
  readOnly?: boolean
  sellerName: string
}) {
  if (readOnly) {
    return <p className="text-sm py-2">{sellerName || "—"}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        id="seller"
        className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base text-ui-fg-base"
        value={sellerChoice}
        onChange={(e) => onSellerChoiceChange(e.target.value)}
        required={sellerChoice !== OTHER_SELLER}
      >
        {founderNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={OTHER_SELLER}>Other name…</option>
      </select>
      {sellerChoice === OTHER_SELLER && (
        <>
          <Input
            id="seller-custom"
            list="offline-seller-names"
            placeholder="Enter seller name"
            value={sellerCustom}
            onChange={(e) => onSellerCustomChange(e.target.value)}
            required
          />
          <datalist id="offline-seller-names">
            {customSellerNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </>
      )}
    </div>
  )
}

function variantUnitPrice(
  variant: AdminVariant,
  currencyCode: string
): number | null {
  const prices = variant.prices ?? []
  const match = prices.find(
    (price) => price.currency_code.toLowerCase() === currencyCode.toLowerCase()
  )
  const amount = match?.amount ?? prices[0]?.amount
  return amount != null && amount > 0 ? amount : null
}

function findVariant(products: AdminProduct[], variantId: string) {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === variantId)
    if (variant) {
      return { product, variant }
    }
  }
  return null
}

function resolveLineItemPrice(
  products: AdminProduct[],
  variantId: string,
  currencyCode: string
): number | null {
  const match = findVariant(products, variantId)
  if (!match) {
    return null
  }
  return variantUnitPrice(match.variant, currencyCode)
}

function locationLabel(location: StockLocation) {
  const city = location.address?.city
  return city ? `${location.name} (${city})` : location.name
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function saleToLineItems(sale: OfflineSale): SaleLineItem[] {
  return (sale.items ?? [])
    .filter((item) => item.variant_id)
    .map((item) => ({
      key: item.variant_id!,
      product_id: item.product_id ?? "",
      product_title: item.product_title ?? item.title,
      variant_id: item.variant_id!,
      variant_title: item.variant_title ?? "",
      title: item.title,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    }))
}

function resolveSaleStockLocation(sale: OfflineSale): string {
  if (sale.metadata?.stock_location_id) {
    return String(sale.metadata.stock_location_id)
  }

  for (const item of sale.items ?? []) {
    if (item.metadata?.stock_location_id) {
      return String(item.metadata.stock_location_id)
    }
  }

  return ""
}

function itemsSummary(sale: OfflineSale) {
  return (sale.items ?? [])
    .map((item) => `${item.title} × ${item.quantity}`)
    .join(", ")
}

// ── sales table ──────────────────────────────────────────────────────────────

function SalesTable({
  sales,
  stockLocations,
  onView,
  onEdit,
  onDelete,
  deletingId,
}: {
  sales: OfflineSale[]
  stockLocations: StockLocation[]
  onView: (sale: OfflineSale) => void
  onEdit: (sale: OfflineSale) => void
  onDelete: (sale: OfflineSale) => void
  deletingId: string | null
}) {
  const locationName = (id?: string) => {
    if (!id) return "—"
    return stockLocations.find((l) => l.id === id)?.name ?? id
  }

  const warehouseLabel = (sale: OfflineSale) => {
    const id = resolveSaleStockLocation(sale)
    return id ? locationName(id) : "— (not set)"
  }

  if (!sales.length) {
    return (
      <p className="text-ui-fg-subtle text-sm py-6 text-center border border-ui-border-base rounded-xl bg-ui-bg-base">
        No offline sales yet. Record your first in-person sale to see it here.
      </p>
    )
  }

  return (
    <div className="border border-ui-border-base rounded-xl overflow-hidden bg-ui-bg-base">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ui-fg-subtle bg-ui-bg-subtle border-b border-ui-border-base">
              <th className="px-4 py-3 font-medium whitespace-nowrap">Order</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Date</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Customer</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Phone</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Seller</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Payment</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Warehouse</th>
              <th className="px-4 py-3 font-medium min-w-[180px]">Items</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Paid</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr
                key={sale.id}
                className="border-b border-ui-border-base last:border-0 hover:bg-ui-bg-subtle/50"
              >
                <td className="px-4 py-3 font-medium whitespace-nowrap">#{sale.display_id}</td>
                <td className="px-4 py-3 text-ui-fg-subtle whitespace-nowrap">
                  {formatDate(sale.created_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {sale.metadata?.customer_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-ui-fg-subtle whitespace-nowrap">
                  {sale.metadata?.customer_phone ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {sale.metadata?.seller_name ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {paymentLabel(sale.metadata?.payment_method)}
                </td>
                <td className="px-4 py-3 text-ui-fg-subtle whitespace-nowrap">
                  {warehouseLabel(sale)}
                </td>
                <td className="px-4 py-3 text-ui-fg-subtle text-xs max-w-[240px] truncate">
                  {itemsSummary(sale) || "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                  {fmt(Number(sale.metadata?.paid_amount ?? 0), sale.currency_code)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end flex-wrap">
                    <Button size="small" variant="secondary" onClick={() => onView(sale)}>
                      View
                    </Button>
                    <Button size="small" variant="secondary" onClick={() => onEdit(sale)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="danger"
                      onClick={() => onDelete(sale)}
                      disabled={deletingId === sale.id}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── line item picker ─────────────────────────────────────────────────────────

function LineItemPicker({
  products,
  currencyCode,
  items,
  onChange,
  readOnly = false,
}: {
  products: AdminProduct[]
  currencyCode: string
  items: SaleLineItem[]
  onChange: (items: SaleLineItem[]) => void
  readOnly?: boolean
}) {
  const [selectedProduct, setSelectedProduct] = useState("")
  const [selectedVariant, setSelectedVariant] = useState("")

  const product = products.find((p) => p.id === selectedProduct)
  const previewVariant = product?.variants.find((v) => v.id === selectedVariant)
  const previewPrice = previewVariant
    ? variantUnitPrice(previewVariant, currencyCode)
    : null

  const addItem = () => {
    if (!product || !selectedVariant) return

    const variant = product.variants.find((v) => v.id === selectedVariant)
    if (!variant) return

    if (items.some((item) => item.variant_id === selectedVariant)) {
      toast.warning("This variant is already in the sale")
      return
    }

    const unitPrice = variantUnitPrice(variant, currencyCode)
    if (unitPrice == null) {
      toast.error(
        `No price found for this variant in ${currencyCode.toUpperCase()}`
      )
      return
    }

    onChange([
      ...items,
      {
        key: selectedVariant,
        product_id: product.id,
        product_title: product.title,
        variant_id: variant.id,
        variant_title: variant.title,
        title: `${product.title} — ${variant.title}`,
        quantity: 1,
        unit_price: unitPrice,
      },
    ])

    setSelectedProduct("")
    setSelectedVariant("")
  }

  const updateItem = (key: string, patch: Partial<SaleLineItem>) => {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  const removeItem = (key: string) => {
    onChange(items.filter((item) => item.key !== key))
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <div className="border border-ui-border-base rounded-md divide-y divide-ui-border-base">
          {items.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-1 md:grid-cols-[1fr_88px_120px_72px] gap-3 p-3 items-end"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.product_title}</p>
                <p className="text-xs text-ui-fg-subtle">{item.variant_title}</p>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Qty</Label>
                {readOnly ? (
                  <p className="text-sm py-2">{item.quantity}</p>
                ) : (
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.key, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Unit price</Label>
                <p className="text-sm font-medium py-2">
                  {fmt(item.unit_price, currencyCode)}
                </p>
              </div>

              {!readOnly && (
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={() => removeItem(item.key)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
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
            {product?.variants.map((v) => {
              const price = variantUnitPrice(v, currencyCode)
              const priceLabel = price != null ? ` — ${fmt(price, currencyCode)}` : ""
              return (
                <option key={v.id} value={v.id}>
                  {v.title}
                  {priceLabel}
                </option>
              )
            })}
          </select>

          {previewPrice != null && (
            <p className="w-full text-xs text-ui-fg-subtle">
              Unit price: {fmt(previewPrice, currencyCode)}
            </p>
          )}

          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={addItem}
            disabled={!selectedProduct || !selectedVariant || previewPrice == null}
          >
            Add item
          </Button>
        </div>
      )}
    </div>
  )
}

// ── sale form ────────────────────────────────────────────────────────────────

function SaleForm({
  stockLocations,
  regions,
  products,
  stockLocationId,
  regionId,
  customerName,
  email,
  customerPhone,
  sellerChoice,
  sellerCustom,
  founderNames,
  customSellerNames,
  paymentMethod,
  discountDisplay,
  items,
  onStockLocationIdChange,
  onRegionIdChange,
  onCustomerNameChange,
  onEmailChange,
  onCustomerPhoneChange,
  onSellerChoiceChange,
  onSellerCustomChange,
  onPaymentMethodChange,
  onDiscountDisplayChange,
  onItemsChange,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
  lockWarehouse = false,
  lockRegion = false,
  readOnly = false,
}: {
  stockLocations: StockLocation[]
  regions: Region[]
  products: AdminProduct[]
  stockLocationId: string
  regionId: string
  customerName: string
  email: string
  customerPhone: string
  sellerChoice: string
  sellerCustom: string
  founderNames: string[]
  customSellerNames: string[]
  paymentMethod: string
  discountDisplay: string
  items: SaleLineItem[]
  onStockLocationIdChange: (value: string) => void
  onRegionIdChange: (value: string) => void
  onCustomerNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onCustomerPhoneChange: (value: string) => void
  onSellerChoiceChange: (value: string) => void
  onSellerCustomChange: (value: string) => void
  onPaymentMethodChange: (value: string) => void
  onDiscountDisplayChange: (value: string) => void
  onItemsChange: (items: SaleLineItem[]) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
  lockWarehouse?: boolean
  lockRegion?: boolean
  readOnly?: boolean
}) {
  const selectedRegion = regions.find((region) => region.id === regionId)
  const currencyCode = selectedRegion?.currency_code ?? "inr"
  const sellerName = resolveSellerName(sellerChoice, sellerCustom)
  const originalTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  )
  const discountApplied = parseMoneyInput(discountDisplay)
  const paidAmount = Math.max(0, originalTotal - discountApplied)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="warehouse">Warehouse</Label>
          {readOnly ? (
            <p className="text-sm py-2">
              {stockLocationId
                ? locationLabel(
                    stockLocations.find((l) => l.id === stockLocationId) ?? {
                      id: stockLocationId,
                      name: stockLocationId,
                    }
                  )
                : "— (not set)"}
            </p>
          ) : (
            <>
              <select
                id="warehouse"
                className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base text-ui-fg-base disabled:opacity-60"
                value={stockLocationId}
                onChange={(e) => onStockLocationIdChange(e.target.value)}
                disabled={lockWarehouse}
              >
                <option value="">Select warehouse…</option>
                {stockLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationLabel(location)}
                  </option>
                ))}
              </select>
              {!stockLocationId && (
                <p className="text-xs text-ui-fg-subtle">
                  This sale has no warehouse on file. Select one before saving.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="region">Region</Label>
          {readOnly ? (
            <p className="text-sm py-2">
              {selectedRegion
                ? `${selectedRegion.name} (${selectedRegion.currency_code.toUpperCase()})`
                : "—"}
            </p>
          ) : (
            <select
              id="region"
              className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base text-ui-fg-base disabled:opacity-60"
              value={regionId}
              onChange={(e) => onRegionIdChange(e.target.value)}
              required
              disabled={lockRegion}
            >
              <option value="">Select region…</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} ({region.currency_code.toUpperCase()})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="customer-name">Customer name</Label>
          {readOnly ? (
            <p className="text-sm py-2">{customerName || "—"}</p>
          ) : (
            <Input
              id="customer-name"
              placeholder="Customer full name"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              required
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="email">Customer email (optional)</Label>
          {readOnly ? (
            <p className="text-sm py-2">{email || "—"}</p>
          ) : (
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="phone">Customer phone (optional)</Label>
          {readOnly ? (
            <p className="text-sm py-2">{customerPhone || "—"}</p>
          ) : (
            <Input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
            />
          )}
          {!readOnly && (
            <p className="text-xs text-ui-fg-subtle">
              Used to identify repeat customers in analytics.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="seller">Seller</Label>
          <SellerField
            founderNames={founderNames}
            customSellerNames={customSellerNames}
            sellerChoice={sellerChoice}
            sellerCustom={sellerCustom}
            onSellerChoiceChange={onSellerChoiceChange}
            onSellerCustomChange={onSellerCustomChange}
            readOnly={readOnly}
            sellerName={sellerName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="payment">Payment method</Label>
          {readOnly ? (
            <p className="text-sm py-2">{paymentLabel(paymentMethod)}</p>
          ) : (
            <select
              id="payment"
              className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base text-ui-fg-base"
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Items</Label>
        <LineItemPicker
          products={products}
          currencyCode={currencyCode}
          items={items}
          onChange={onItemsChange}
          readOnly={readOnly}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="discount">Discount ({currencyCode.toUpperCase()})</Label>
          {readOnly ? (
            <p className="text-sm py-2">{fmt(discountApplied, currencyCode)}</p>
          ) : (
            <Input
              id="discount"
              type="number"
              min={0}
              step="0.01"
              value={discountDisplay}
              onChange={(e) => onDiscountDisplayChange(e.target.value)}
            />
          )}
        </div>

        <div className="border border-ui-border-base rounded-md p-4 flex flex-col gap-1 bg-ui-bg-subtle">
          <div className="flex justify-between text-sm">
            <span className="text-ui-fg-subtle">Subtotal</span>
            <span>{fmt(originalTotal, currencyCode)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ui-fg-subtle">Discount</span>
            <span>-{fmt(discountApplied, currencyCode)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold pt-1 border-t border-ui-border-base">
            <span>Amount paid</span>
            <span>{fmt(paidAmount, currencyCode)}</span>
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

const OfflineSalesPage = () => {
  const [sales, setSales] = useState<OfflineSale[]>([])
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mode, setMode] = useState<PageMode>("list")

  const [stockLocationId, setStockLocationId] = useState("")
  const [regionId, setRegionId] = useState("")
  const [founderNames, setFounderNames] = useState<string[]>([])
  const [customSellerNames, setCustomSellerNames] = useState<string[]>([])
  const [customerName, setCustomerName] = useState("")
  const [email, setEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [sellerChoice, setSellerChoice] = useState("")
  const [sellerCustom, setSellerCustom] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [discountDisplay, setDiscountDisplay] = useState("0")
  const [items, setItems] = useState<SaleLineItem[]>([])

  const selectedRegion = regions.find((region) => region.id === regionId)
  const currencyCode = selectedRegion?.currency_code ?? "inr"
  const sellerName = resolveSellerName(sellerChoice, sellerCustom)
  const isCreateMode = mode === "create"
  const isEditMode = typeof mode === "object" && "edit" in mode
  const isViewMode = typeof mode === "object" && "view" in mode

  const loadData = useCallback(async () => {
    const [offlineRes, productRes] = await Promise.all([
      fetch("/admin/offline-sales", { credentials: "include" }),
      fetch(
        "/admin/products?limit=100&fields=id,title,thumbnail,*variants,*variants.prices",
        { credentials: "include" }
      ),
    ])

    if (!offlineRes.ok || !productRes.ok) {
      throw new Error("Failed to load offline sales")
    }

    const offlineData = await offlineRes.json()
    const productData = await productRes.json()

    setSales(offlineData.sales ?? [])
    setStockLocations(offlineData.stock_locations ?? [])
    setRegions(offlineData.regions ?? [])
    setFounderNames(offlineData.founder_names ?? [])
    setCustomSellerNames(offlineData.custom_seller_names ?? [])
    setProducts(productData.products ?? [])

    return offlineData as {
      stock_locations: StockLocation[]
      regions: Region[]
      founder_names: string[]
      custom_seller_names: string[]
    }
  }, [])

  useEffect(() => {
    loadData()
      .then((setup) => {
        if (setup.stock_locations.length === 1) {
          setStockLocationId(setup.stock_locations[0].id)
        }
        if (setup.regions.length === 1) {
          setRegionId(setup.regions[0].id)
        } else {
          const india = setup.regions.find(
            (region) => region.currency_code.toLowerCase() === "inr"
          )
          if (india) {
            setRegionId(india.id)
          }
        }
      })
      .catch(() => toast.error("Failed to load offline sales"))
      .finally(() => setLoading(false))
  }, [loadData])

  useEffect(() => {
    if (!isCreateMode || !items.length || !products.length) {
      return
    }

    setItems((prev) =>
      prev.map((item) => {
        const price = resolveLineItemPrice(products, item.variant_id, currencyCode)
        return price != null ? { ...item, unit_price: price } : item
      })
    )
  }, [currencyCode, products, isCreateMode])

  useEffect(() => {
    if (!isCreateMode || !founderNames.length || sellerChoice) {
      return
    }

    const resolved = resolveSellerChoice(
      localStorage.getItem(LAST_SELLER_KEY) ?? founderNames[0],
      founderNames
    )
    setSellerChoice(resolved.choice)
    setSellerCustom(resolved.custom)
  }, [isCreateMode, founderNames, sellerChoice])

  const resetForm = () => {
    setCustomerName("")
    setEmail("")
    setCustomerPhone("")
    const resolved = resolveSellerChoice(
      localStorage.getItem(LAST_SELLER_KEY) ?? founderNames[0] ?? "",
      founderNames
    )
    setSellerChoice(resolved.choice)
    setSellerCustom(resolved.custom)
    setPaymentMethod("cash")
    setDiscountDisplay("0")
    setItems([])
    if (stockLocations.length === 1) {
      setStockLocationId(stockLocations[0].id)
    } else {
      setStockLocationId("")
    }
    if (regions.length === 1) {
      setRegionId(regions[0].id)
    } else {
      const india = regions.find((region) => region.currency_code.toLowerCase() === "inr")
      setRegionId(india?.id ?? "")
    }
  }

  const populateFormFromSale = (sale: OfflineSale) => {
    let warehouseId = resolveSaleStockLocation(sale)
    if (!warehouseId && stockLocations.length === 1) {
      warehouseId = stockLocations[0].id
    }
    setStockLocationId(warehouseId)
    setRegionId(sale.region_id ?? "")
    setCustomerName(String(sale.metadata?.customer_name ?? ""))
    setEmail(sale.email ?? "")
    setCustomerPhone(String(sale.metadata?.customer_phone ?? ""))
    const resolved = resolveSellerChoice(
      String(sale.metadata?.seller_name ?? ""),
      founderNames
    )
    setSellerChoice(resolved.choice)
    setSellerCustom(resolved.custom)
    setPaymentMethod(String(sale.metadata?.payment_method ?? "cash"))
    setDiscountDisplay(String(sale.metadata?.discount_applied ?? 0))
    setItems(saleToLineItems(sale))
  }

  const buildPayload = () => {
    const originalTotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    )
    const discountApplied = parseMoneyInput(discountDisplay)
    const paidAmount = Math.max(0, originalTotal - discountApplied)

    return {
      customer_name: customerName.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(customerPhone.trim() ? { customer_phone: customerPhone.trim() } : {}),
      seller_name: sellerName.trim(),
      payment_method: paymentMethod,
      region_id: regionId,
      currency_code: currencyCode,
      stock_location_id: stockLocationId,
      items: items.map((item) => ({
        product_id: item.product_id,
        product_title: item.product_title,
        title: item.title,
        variant_id: item.variant_id,
        variant_title: item.variant_title,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      original_total: originalTotal,
      paid_amount: paidAmount,
      discount_applied: discountApplied,
    }
  }

  const validateForm = () => {
    if (!stockLocationId) {
      toast.error("Select a warehouse — this sale is missing warehouse data")
      return false
    }
    if (!regionId) {
      toast.error("Select a region")
      return false
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required")
      return false
    }
    if (!sellerName.trim()) {
      toast.error(
        sellerChoice === OTHER_SELLER ? "Enter a seller name" : "Select a seller"
      )
      return false
    }
    if (!items.length) {
      toast.error("Add at least one item")
      return false
    }
    if (items.some((item) => item.unit_price <= 0)) {
      toast.error("One or more items are missing a price for the selected region")
      return false
    }
    return true
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const res = await fetch("/admin/offline-sales", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? "Failed to record offline sale")
      }

      await loadData()
      localStorage.setItem(LAST_SELLER_KEY, sellerName.trim())
      const orderLabel = data.order?.display_id ?? data.order?.id ?? "order"
      toast.success(`Offline sale recorded (order #${orderLabel})`)
      resetForm()
      setMode("list")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record offline sale")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEditMode || !validateForm()) return

    setSubmitting(true)
    try {
      const saleId = mode.edit.id
      const res = await fetch(`/admin/offline-sales/${saleId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? "Failed to update offline sale")
      }

      await loadData()
      toast.success("Offline sale updated")
      setMode("list")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update offline sale")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (sale: OfflineSale) => {
    if (
      !window.confirm(
        `Delete offline sale #${sale.display_id}? Stock will be restored and the order canceled.`
      )
    ) {
      return
    }

    setDeletingId(sale.id)
    try {
      const res = await fetch(`/admin/offline-sales/${sale.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? "Failed to delete offline sale")
      }

      await loadData()
      toast.success("Offline sale deleted")
      if (
        (typeof mode === "object" && "view" in mode && mode.view.id === sale.id) ||
        (typeof mode === "object" && "edit" in mode && mode.edit.id === sale.id)
      ) {
        setMode("list")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete offline sale")
    } finally {
      setDeletingId(null)
    }
  }

  const activeSales = useMemo(
    () => sales.filter((sale) => !sale.canceled_at),
    [sales]
  )

  const stats = useMemo(() => computeOfflineSaleStats(activeSales), [activeSales])

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Heading level="h1">Offline Sales</Heading>
          <p className="text-ui-fg-subtle text-sm mt-1">
            Record, review, edit, and delete in-person sales.
          </p>
        </div>
        {mode === "list" && (
          <Button
            onClick={() => {
              resetForm()
              setMode("create")
            }}
          >
            New offline sale
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-ui-fg-subtle text-sm">Loading…</p>
      ) : (
        <>
          {mode === "list" && (
            <>
              <OfflineSalesDashboard stats={stats} />

              <div className="flex flex-col gap-3">
                <Heading level="h2">All sales</Heading>
                <SalesTable
                  sales={activeSales}
                  stockLocations={stockLocations}
                  onView={(sale) => {
                    populateFormFromSale(sale)
                    setMode({ view: sale })
                  }}
                  onEdit={(sale) => {
                    populateFormFromSale(sale)
                    setMode({ edit: sale })
                  }}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              </div>
            </>
          )}

          {isCreateMode && (
            <SaleForm
              stockLocations={stockLocations}
              regions={regions}
              products={products}
              stockLocationId={stockLocationId}
              regionId={regionId}
              customerName={customerName}
              email={email}
              customerPhone={customerPhone}
              sellerChoice={sellerChoice}
              sellerCustom={sellerCustom}
              founderNames={founderNames}
              customSellerNames={customSellerNames}
              paymentMethod={paymentMethod}
              discountDisplay={discountDisplay}
              items={items}
              onStockLocationIdChange={setStockLocationId}
              onRegionIdChange={setRegionId}
              onCustomerNameChange={setCustomerName}
              onEmailChange={setEmail}
              onCustomerPhoneChange={setCustomerPhone}
              onSellerChoiceChange={setSellerChoice}
              onSellerCustomChange={setSellerCustom}
              onPaymentMethodChange={setPaymentMethod}
              onDiscountDisplayChange={setDiscountDisplay}
              onItemsChange={setItems}
              onSubmit={handleCreate}
              onCancel={() => setMode("list")}
              saving={submitting}
              submitLabel="Record offline sale"
            />
          )}

          {isViewMode && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setMode("list")}>
                  Back
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setMode({ edit: mode.view })}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(mode.view)}
                  disabled={deletingId === mode.view.id}
                >
                  Delete
                </Button>
              </div>
              <SaleForm
                stockLocations={stockLocations}
                regions={regions}
                products={products}
                stockLocationId={stockLocationId}
                regionId={regionId}
                customerName={customerName}
                email={email}
                customerPhone={customerPhone}
                sellerChoice={sellerChoice}
                sellerCustom={sellerCustom}
                founderNames={founderNames}
                customSellerNames={customSellerNames}
                paymentMethod={paymentMethod}
                discountDisplay={discountDisplay}
                items={items}
                onStockLocationIdChange={setStockLocationId}
                onRegionIdChange={setRegionId}
                onCustomerNameChange={setCustomerName}
                onEmailChange={setEmail}
                onCustomerPhoneChange={setCustomerPhone}
                onSellerChoiceChange={setSellerChoice}
                onSellerCustomChange={setSellerCustom}
                onPaymentMethodChange={setPaymentMethod}
                onDiscountDisplayChange={setDiscountDisplay}
                onItemsChange={setItems}
                onSubmit={(e) => e.preventDefault()}
                onCancel={() => setMode("list")}
                saving={false}
                submitLabel=""
                lockWarehouse
                lockRegion
                readOnly
              />
            </div>
          )}

          {isEditMode && (
            <SaleForm
              stockLocations={stockLocations}
              regions={regions}
              products={products}
              stockLocationId={stockLocationId}
              regionId={regionId}
              customerName={customerName}
              email={email}
              customerPhone={customerPhone}
              sellerChoice={sellerChoice}
              sellerCustom={sellerCustom}
              founderNames={founderNames}
              customSellerNames={customSellerNames}
              paymentMethod={paymentMethod}
              discountDisplay={discountDisplay}
              items={items}
              onStockLocationIdChange={setStockLocationId}
              onRegionIdChange={setRegionId}
              onCustomerNameChange={setCustomerName}
              onEmailChange={setEmail}
              onCustomerPhoneChange={setCustomerPhone}
              onSellerChoiceChange={setSellerChoice}
              onSellerCustomChange={setSellerCustom}
              onPaymentMethodChange={setPaymentMethod}
              onDiscountDisplayChange={setDiscountDisplay}
              onItemsChange={setItems}
              onSubmit={handleUpdate}
              onCancel={() => setMode("list")}
              saving={submitting}
              submitLabel="Save changes"
              lockRegion
            />
          )}
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Offline Sales",
  icon: BuildingStorefront,
})

export default OfflineSalesPage
