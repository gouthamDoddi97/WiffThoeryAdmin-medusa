import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/framework/types"
import { Badge, Heading, Label, toast } from "@medusajs/ui"
import { useState } from "react"
import {
  getProductAvailability,
  type ProductAvailability,
} from "../../utils/product-availability"

const ProductStorefrontAvailabilityWidget = ({ data }: { data: AdminProduct }) => {
  const [availability, setAvailability] = useState<ProductAvailability>(() =>
    getProductAvailability(data)
  )
  const [saving, setSaving] = useState(false)

  const save = async (next: ProductAvailability) => {
    setSaving(true)
    try {
      const res = await fetch(`/admin/products/${data.id}/availability`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: next }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? "Failed to update availability")
      setAvailability(json.availability ?? next)
      toast.success(
        next === "offline"
          ? "Product set to Offline — hidden from storefront"
          : "Product set to Online — visible on storefront"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update availability")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-base flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Heading level="h2">Storefront availability</Heading>
          <p className="text-xs text-ui-fg-subtle mt-1">
            Offline products stay in admin and offline sales, but are hidden from the website.
          </p>
        </div>
        <Badge size="small" color={availability === "offline" ? "orange" : "green"}>
          {availability === "offline" ? "Offline" : "Online"}
        </Badge>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Status</Label>
        <select
          className="border border-ui-border-base rounded-md px-2 py-1.5 text-sm bg-ui-bg-base max-w-xs"
          value={availability}
          disabled={saving}
          onChange={(e) => save(e.target.value as ProductAvailability)}
        >
          <option value="online">Online — visible on storefront</option>
          <option value="offline">Offline — hidden from storefront</option>
        </select>
      </div>

      {availability === "offline" && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          This product is published for inventory and offline retail, but customers will not see it on whiff-theory.com.
        </p>
      )}
    </div>
  )
}

export default ProductStorefrontAvailabilityWidget

export const config = defineWidgetConfig({
  zone: "product.details.before",
})
