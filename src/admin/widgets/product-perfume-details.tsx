import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct } from "@medusajs/framework/types"
import { Button, Heading, Input, Label, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type PerfumeDetails = {
  certifications: string
  top_notes: string
  middle_notes: string
  base_notes: string
  scent_story: string
  usage_tips: string
  ingredients: string
  brand_info: string
  manufacturer_info: string
  license_no: string
  expiry_info: string
  customer_care: string
}

const defaultDetails: PerfumeDetails = {
  certifications: "",
  top_notes: "",
  middle_notes: "",
  base_notes: "",
  scent_story: "",
  usage_tips: "",
  ingredients: "",
  brand_info: "",
  manufacturer_info: "",
  license_no: "",
  expiry_info: "",
  customer_care: "",
}

const PerfumeDetailsWidget = ({ data }: { data: AdminProduct }) => {
  const [details, setDetails] = useState<PerfumeDetails>(defaultDetails)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/admin/products/${data.id}/perfume-details`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(({ perfume_details }) => {
        if (perfume_details) {
          setDetails({
            certifications: perfume_details.certifications ?? "",
            top_notes: perfume_details.top_notes ?? "",
            middle_notes: perfume_details.middle_notes ?? "",
            base_notes: perfume_details.base_notes ?? "",
            scent_story: perfume_details.scent_story ?? "",
            usage_tips: perfume_details.usage_tips ?? "",
            ingredients: perfume_details.ingredients ?? "",
            brand_info: perfume_details.brand_info ?? "",
            manufacturer_info: perfume_details.manufacturer_info ?? "",
            license_no: perfume_details.license_no ?? "",
            expiry_info: perfume_details.expiry_info ?? "",
            customer_care: perfume_details.customer_care ?? "",
          })
        }
      })
      .finally(() => setLoading(false))
  }, [data.id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setDetails((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/admin/products/${data.id}/perfume-details`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      })
      if (!res.ok) throw new Error("Save failed")
      toast.success("Perfume details saved")
    } catch {
      toast.error("Failed to save perfume details")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6">
        <p className="text-ui-fg-subtle text-sm">Loading perfume details…</p>
      </div>
    )
  }

  return (
    <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6 flex flex-col gap-y-6">
      <Heading level="h2">Perfume Details</Heading>

      {/* Certifications */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="certifications" size="small">
          Certifications
        </Label>
        <Input
          id="certifications"
          name="certifications"
          placeholder="e.g. Vegan | Cruelty Free | Clean"
          value={details.certifications}
          onChange={handleChange}
        />
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="top_notes" size="small">Top Notes</Label>
          <Input
            id="top_notes"
            name="top_notes"
            placeholder="e.g. Bergamot"
            value={details.top_notes}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="middle_notes" size="small">Middle Notes</Label>
          <Input
            id="middle_notes"
            name="middle_notes"
            placeholder="e.g. Angelica, Patchouli"
            value={details.middle_notes}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="base_notes" size="small">Base Notes</Label>
          <Input
            id="base_notes"
            name="base_notes"
            placeholder="e.g. Coumarin, Amber, Musk"
            value={details.base_notes}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Scent Story */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="scent_story" size="small">Scent Story</Label>
        <Textarea
          id="scent_story"
          name="scent_story"
          placeholder="Describe the scent journey…"
          value={details.scent_story}
          onChange={handleChange}
          rows={5}
        />
      </div>

      {/* Usage Tips */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="usage_tips" size="small">Usage Tips</Label>
        <Textarea
          id="usage_tips"
          name="usage_tips"
          placeholder="How to apply the fragrance…"
          value={details.usage_tips}
          onChange={handleChange}
          rows={3}
        />
      </div>

      {/* Ingredients */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="ingredients" size="small">Ingredients</Label>
        <Textarea
          id="ingredients"
          name="ingredients"
          placeholder="Full ingredient list…"
          value={details.ingredients}
          onChange={handleChange}
          rows={3}
        />
      </div>

      {/* Brand & Manufacturer */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="brand_info" size="small">Brand / Marketed By</Label>
          <Textarea
            id="brand_info"
            name="brand_info"
            placeholder="Brand address…"
            value={details.brand_info}
            onChange={handleChange}
            rows={2}
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="manufacturer_info" size="small">Manufactured By</Label>
          <Textarea
            id="manufacturer_info"
            name="manufacturer_info"
            placeholder="Manufacturer address…"
            value={details.manufacturer_info}
            onChange={handleChange}
            rows={2}
          />
        </div>
      </div>

      {/* License / Expiry / Customer Care */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="license_no" size="small">License No.</Label>
          <Input
            id="license_no"
            name="license_no"
            placeholder="e.g. Cos-8/01/2024"
            value={details.license_no}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="expiry_info" size="small">Expiry Info</Label>
          <Input
            id="expiry_info"
            name="expiry_info"
            placeholder="e.g. 3 years from manufacturing"
            value={details.expiry_info}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="customer_care" size="small">Customer Care</Label>
          <Input
            id="customer_care"
            name="customer_care"
            placeholder="e.g. support@example.com"
            value={details.customer_care}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={saving} size="small">
          Save Perfume Details
        </Button>
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default PerfumeDetailsWidget
