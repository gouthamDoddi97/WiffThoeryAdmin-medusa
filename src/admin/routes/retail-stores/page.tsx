import { defineRouteConfig } from "@medusajs/admin-sdk"
import { MapPin } from "@medusajs/icons"
import { Button, Heading, Input, Label, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useCaAccessGuard } from "../../lib/ca-access"

type Warehouse = {
  id: string
  name: string
  address?: { city?: string; country_code?: string }
}

type RetailStore = {
  id: string
  name: string
  location: string
  stock_location_id: string
  is_active: boolean
  notes?: string | null
}

type StoreInventoryItem = {
  variant_id: string
  sku: string | null
  product_id: string | null
  product_title: string | null
  variant_title: string | null
  quantity: number
  available: number
}

type AdminVariant = {
  id: string
  title: string
  sku?: string | null
  product?: { id: string; title: string }
}

type PageMode = "list" | "create" | { manage: RetailStore }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message ?? "Request failed")
  }
  return data as T
}

function warehouseLabel(location: Warehouse) {
  const city = location.address?.city
  return city ? `${location.name} (${city})` : location.name
}

const RetailStoresPage = () => {
  useCaAccessGuard()

  const [stores, setStores] = useState<RetailStore[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<
    Array<{ id: string; title: string; variants: AdminVariant[] }>
  >([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<PageMode>("list")
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")

  const [inventory, setInventory] = useState<StoreInventoryItem[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [transferWarehouseId, setTransferWarehouseId] = useState("")
  const [transferVariantId, setTransferVariantId] = useState("")
  const [transferQty, setTransferQty] = useState("1")
  const [transferNotes, setTransferNotes] = useState("")

  const activeStore = typeof mode === "object" && "manage" in mode ? mode.manage : null

  const variantOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = []
    for (const product of products) {
      for (const variant of product.variants ?? []) {
        const sku = variant.sku ? ` · ${variant.sku}` : ""
        options.push({
          id: variant.id,
          label: `${product.title} — ${variant.title}${sku}`,
        })
      }
    }
    return options
  }, [products])

  const loadStores = useCallback(async () => {
    const data = await api<{ stores: RetailStore[]; warehouses: Warehouse[] }>(
      "/admin/retail-stores"
    )
    setStores(data.stores ?? [])
    setWarehouses(data.warehouses ?? [])
    if (!transferWarehouseId && data.warehouses?.length === 1) {
      setTransferWarehouseId(data.warehouses[0].id)
    }
    return data
  }, [transferWarehouseId])

  const loadProducts = useCallback(async () => {
    const data = await api<{ products: Array<{ id: string; title: string; variants: AdminVariant[] }> }>(
      "/admin/products?limit=100&fields=id,title,*variants,*variants.sku"
    )
    setProducts(data.products ?? [])
  }, [])

  const loadInventory = useCallback(async (storeId: string) => {
    setInventoryLoading(true)
    try {
      const data = await api<{ items: StoreInventoryItem[] }>(`/admin/retail-stores/${storeId}`)
      setInventory(data.items ?? [])
    } finally {
      setInventoryLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadStores(), loadProducts()])
      .catch(() => toast.error("Failed to load retail stores"))
      .finally(() => setLoading(false))
  }, [loadStores, loadProducts])

  useEffect(() => {
    if (activeStore) {
      loadInventory(activeStore.id).catch(() => toast.error("Failed to load store inventory"))
    }
  }, [activeStore, loadInventory])

  const resetCreateForm = () => {
    setName("")
    setLocation("")
    setNotes("")
  }

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !location.trim()) {
      toast.error("Store name and location are required")
      return
    }

    setSaving(true)
    try {
      await api("/admin/retail-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          notes: notes.trim() || undefined,
        }),
      })
      await loadStores()
      toast.success("Retail store created")
      resetCreateForm()
      setMode("list")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create store")
    } finally {
      setSaving(false)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeStore) return

    const quantity = Number(transferQty)
    if (!transferWarehouseId) {
      toast.error("Select a warehouse")
      return
    }
    if (!transferVariantId) {
      toast.error("Select a SKU / variant")
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity")
      return
    }

    setSaving(true)
    try {
      const variantLabel =
        variantOptions.find((option) => option.id === transferVariantId)?.label ??
        transferVariantId

      const data = await api<{ items: StoreInventoryItem[] }>(
        `/admin/retail-stores/${activeStore.id}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_stock_location_id: transferWarehouseId,
            items: [
              {
                variant_id: transferVariantId,
                quantity,
                title: variantLabel,
              },
            ],
            notes: transferNotes.trim() || undefined,
          }),
        }
      )

      setInventory(data.items ?? [])
      setTransferVariantId("")
      setTransferQty("1")
      setTransferNotes("")
      toast.success("Stock moved from warehouse to store shelf")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transfer failed")
    } finally {
      setSaving(false)
    }
  }

  const toggleStoreActive = async (store: RetailStore) => {
    try {
      await api(`/admin/retail-stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !store.is_active }),
      })
      await loadStores()
      toast.success(store.is_active ? "Store deactivated" : "Store activated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed")
    }
  }

  if (loading) {
    return <p className="text-ui-fg-subtle text-sm p-6">Loading retail stores…</p>
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Heading level="h1">Retail Stores</Heading>
          <p className="text-ui-fg-subtle text-sm mt-1">
            Create in-person display locations, borrow stock from a warehouse, and record offline
            sales against each store&apos;s shelf inventory.
          </p>
        </div>
        {mode === "list" && (
          <Button onClick={() => setMode("create")}>Add store</Button>
        )}
      </div>

      {mode === "create" && (
        <form
          onSubmit={handleCreateStore}
          className="border border-ui-border-base rounded-xl p-5 bg-ui-bg-base flex flex-col gap-4"
        >
          <Heading level="h2">New retail store</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="store-name">Store name</Label>
              <Input
                id="store-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Phoenix Mall kiosk"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="store-location">Location</Label>
              <Input
                id="store-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, mall, or full address"
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="store-notes">Notes (optional)</Label>
            <Input
              id="store-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contact person, timings, etc."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetCreateForm()
                setMode("list")
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Create store
            </Button>
          </div>
        </form>
      )}

      {activeStore && (
        <div className="border border-ui-border-base rounded-xl p-5 bg-ui-bg-base flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Heading level="h2">{activeStore.name}</Heading>
              <p className="text-sm text-ui-fg-subtle mt-1">{activeStore.location}</p>
            </div>
            <Button variant="secondary" onClick={() => setMode("list")}>
              Back to list
            </Button>
          </div>

          <form onSubmit={handleTransfer} className="border border-ui-border-base rounded-lg p-4 flex flex-col gap-3 bg-ui-bg-subtle">
            <Heading level="h3">Borrow from warehouse</Heading>
            <p className="text-xs text-ui-fg-subtle">
              Moves units from the selected warehouse into this store&apos;s shelf inventory.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <Label>Warehouse</Label>
                <select
                  className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
                  value={transferWarehouseId}
                  onChange={(e) => setTransferWarehouseId(e.target.value)}
                >
                  <option value="">Select warehouse…</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouseLabel(warehouse)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label>SKU / variant</Label>
                <select
                  className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base"
                  value={transferVariantId}
                  onChange={(e) => setTransferVariantId(e.target.value)}
                >
                  <option value="">Select product variant…</option>
                  {variantOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                />
              </div>
            </div>
            <Input
              placeholder="Transfer notes (optional)"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" isLoading={saving}>
                Move to store shelf
              </Button>
            </div>
          </form>

          <div>
            <Heading level="h3">On-shelf inventory</Heading>
            {inventoryLoading ? (
              <p className="text-sm text-ui-fg-subtle py-4">Loading inventory…</p>
            ) : !inventory.length ? (
              <p className="text-sm text-ui-fg-subtle py-4">
                No stock on this shelf yet. Transfer items from a warehouse above.
              </p>
            ) : (
              <div className="border border-ui-border-base rounded-lg overflow-hidden mt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ui-fg-subtle bg-ui-bg-subtle border-b border-ui-border-base">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-right">On shelf</th>
                      <th className="px-4 py-3 text-right">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={item.variant_id} className="border-b border-ui-border-base last:border-0">
                        <td className="px-4 py-3">{item.product_title ?? "—"}</td>
                        <td className="px-4 py-3">{item.variant_title ?? "—"}</td>
                        <td className="px-4 py-3 text-ui-fg-subtle">{item.sku ?? "—"}</td>
                        <td className="px-4 py-3 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">{item.available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "list" && (
        <div className="border border-ui-border-base rounded-xl overflow-hidden bg-ui-bg-base">
          {!stores.length ? (
            <p className="text-sm text-ui-fg-subtle p-6 text-center">
              No retail stores yet. Add one to start moving display stock and recording in-store
              sales.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ui-fg-subtle bg-ui-bg-subtle border-b border-ui-border-base">
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="border-b border-ui-border-base last:border-0">
                    <td className="px-4 py-3 font-medium">{store.name}</td>
                    <td className="px-4 py-3 text-ui-fg-subtle">{store.location}</td>
                    <td className="px-4 py-3">
                      {store.is_active ? (
                        <span className="text-ui-tag-green-text">Active</span>
                      ) : (
                        <span className="text-ui-fg-subtle">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => setMode({ manage: store })}
                        >
                          Manage stock
                        </Button>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => toggleStoreActive(store)}
                        >
                          {store.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Retail Stores",
  icon: MapPin,
})

export default RetailStoresPage
