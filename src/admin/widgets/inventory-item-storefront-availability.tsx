import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Heading, Label, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import type { StorefrontAvailability } from "../../utils/product-availability"

type InventoryItemRow = {
  id: string
  title?: string | null
  sku?: string | null
  metadata?: Record<string, unknown> | null
}

const InventoryItemStorefrontAvailabilityWidget = ({
  data,
}: {
  data: InventoryItemRow
}) => {
  const [availability, setAvailability] = useState<StorefrontAvailability | null>(
    null
  )
  const [linkedVariants, setLinkedVariants] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/admin/inventory-items/${data.id}/availability`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { availability?: StorefrontAvailability; variant_ids?: string[] } | null) => {
        if (cancelled || !json) return
        setAvailability(json.availability ?? "online")
        setLinkedVariants(json.variant_ids ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [data.id])

  const save = async (next: StorefrontAvailability) => {
    setSaving(true)
    try {
      const res = await fetch(`/admin/inventory-items/${data.id}/availability`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message ?? "Failed to update availability")
      }

      setAvailability(json.availability ?? next)
      setLinkedVariants(json.variant_ids ?? [])
      toast.success(
        next === "offline"
          ? "Inventory set to Offline — linked variant(s) hidden on storefront"
          : "Inventory set to Online — linked variant(s) visible on storefront"
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update availability"
      )
    } finally {
      setSaving(false)
    }
  }

  const label = data.title?.trim() || data.sku?.trim() || data.id

  return (
    <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-base flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Heading level="h2">Storefront availability</Heading>
          <Text size="small" className="text-ui-fg-muted mt-1">
            Offline inventory stays in admin and offline sales, but its linked
            product variant(s) are hidden on whiff-theory.com.
          </Text>
        </div>
        <Badge
          size="small"
          color={
            loading || availability === null
              ? "grey"
              : availability === "offline"
                ? "orange"
                : "green"
          }
        >
          {loading || availability === null
            ? "Loading…"
            : availability === "offline"
              ? "Offline"
              : "Online"}
        </Badge>
      </div>

      <Text size="small" className="text-ui-fg-subtle">
        Item: {label}
      </Text>

      <div className="flex flex-col gap-1">
        <Label>Status</Label>
        <select
          className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base max-w-xs"
          value={availability ?? "online"}
          disabled={loading || saving || availability === null}
          onChange={(e) => save(e.target.value as StorefrontAvailability)}
        >
          <option value="online">Online — variant visible on storefront</option>
          <option value="offline">Offline — variant hidden on storefront</option>
        </select>
      </div>

      {linkedVariants.length > 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          Applies to {linkedVariants.length} linked product variant
          {linkedVariants.length === 1 ? "" : "s"}.
        </Text>
      ) : (
        <Text size="small" className="text-amber-700 dark:text-amber-300">
          No product variant is linked to this inventory item yet — link a variant
          under Products for this setting to affect the storefront.
        </Text>
      )}

      {availability === "offline" && linkedVariants.length > 0 && (
        <Text size="small" className="text-amber-700 dark:text-amber-300">
          Only linked variant(s) for this inventory item are hidden. Other
          sizes/SKUs on the same product stay online unless their inventory is
          also offline. The whole product is hidden only when every variant is
          offline or the product itself is set to Offline on the product page.
        </Text>
      )}
    </div>
  )
}

export default InventoryItemStorefrontAvailabilityWidget

export const config = defineWidgetConfig({
  zone: "inventory_item.details.before",
})
