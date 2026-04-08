import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProductCategory } from "@medusajs/framework/types"
import { Button, Heading, Input, Label, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type TierDetails = {
  category_handle: string
  tier_number: string
  tagline: string
  description: string
  accent_color: string
  next_tier_label: string
  next_tier_href: string
  next_tier_cta: string
  image_url: string
}

const defaultDetails = (handle: string): TierDetails => ({
  category_handle: handle,
  tier_number: "",
  tagline: "",
  description: "",
  accent_color: "",
  next_tier_label: "",
  next_tier_href: "",
  next_tier_cta: "",
  image_url: "",
})

const CategoryTierDetailsWidget = ({ data }: { data: AdminProductCategory }) => {
  const [details, setDetails] = useState<TierDetails>(defaultDetails(data.handle ?? ""))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetch(`/admin/categories/${data.id}/collection-tier`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(({ collection_tier }) => {
        if (collection_tier) {
          setDetails({
            category_handle: collection_tier.category_handle ?? data.handle ?? "",
            tier_number: collection_tier.tier_number ?? "",
            tagline: collection_tier.tagline ?? "",
            description: collection_tier.description ?? "",
            accent_color: collection_tier.accent_color ?? "",
            next_tier_label: collection_tier.next_tier_label ?? "",
            next_tier_href: collection_tier.next_tier_href ?? "",
            next_tier_cta: collection_tier.next_tier_cta ?? "",
            image_url: collection_tier.image_url ?? "",
          })
        }
      })
      .finally(() => setLoading(false))
  }, [data.id, data.handle])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setDetails((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/admin/categories/${data.id}/collection-tier`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      })
      if (!res.ok) throw new Error("Save failed")
      toast.success("Tier details saved")
    } catch {
      toast.error("Failed to save tier details")
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("files", file)

      const res = await fetch("/admin/uploads", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")
      const { files } = await res.json()
      const uploadedUrl = files[0]?.url || files[0]?.file_url
      
      if (uploadedUrl) {
        setDetails((prev) => ({ ...prev, image_url: uploadedUrl }))
        toast.success("Image uploaded successfully")
      } else {
        throw new Error("No URL returned")
      }
    } catch {
      toast.error("Failed to upload image")
    } finally {
      setUploading(false)
      // Reset the input
      event.target.value = ""
    }
  }

  if (loading) {
    return (
      <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6">
        <p className="text-ui-fg-subtle text-sm">Loading tier details…</p>
      </div>
    )
  }

  return (
    <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6 flex flex-col gap-y-6">
      <Heading level="h2">Collection Tier Details</Heading>
      <p className="text-ui-fg-subtle text-sm -mt-4">
        Controls the marketing display on the storefront collection page for this category.
      </p>

      {/* Collection Handle */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="category_handle" size="small">
          Storefront Collection Handle
        </Label>
        <Input
          id="category_handle"
          name="category_handle"
          placeholder="e.g. popular"
          value={details.category_handle}
          onChange={handleChange}
        />
        <p className="text-ui-fg-subtle text-xs">
          Must match the collection handle in the storefront (e.g. <code>popular</code>). This is how the storefront finds this tier's data.
        </p>
      </div>

      {/* Tier Number + Accent Color */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="tier_number" size="small">
            Tier Number
          </Label>
          <Input
            id="tier_number"
            name="tier_number"
            placeholder="e.g. TIER 01 / 03"
            value={details.tier_number}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="accent_color" size="small">
            Accent Color (hex)
          </Label>
          <Input
            id="accent_color"
            name="accent_color"
            placeholder="e.g. #4FDBCC"
            value={details.accent_color}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Tagline */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="tagline" size="small">
          Tagline
        </Label>
        <Input
          id="tagline"
          name="tagline"
          placeholder="e.g. Your entry point. Instantly loved."
          value={details.tagline}
          onChange={handleChange}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="description" size="small">
          Description
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="A short paragraph shown on the collection hero…"
          value={details.description}
          onChange={handleChange}
          rows={3}
        />
      </div>

      {/* Background Image */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="image_upload" size="small">
          Category Background Image
        </Label>
        
        {details.image_url && (
          <div className="mb-3">
            <img
              src={details.image_url}
              alt="Category background preview"
              className="h-24 w-40 object-cover rounded border"
            />
          </div>
        )}
        
        <input
          id="image_upload"
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-ui-bg-subtle hover:file:bg-ui-bg-subtle-hover"
        />
        
        <p className="text-ui-fg-subtle text-xs">
          {uploading ? "Uploading..." : "Upload an image for the home page tier card background."}
        </p>
        
        {details.image_url && (
          <button
            type="button"
            onClick={() => setDetails((prev) => ({ ...prev, image_url: "" }))}
            className="text-xs text-ui-fg-subtle hover:text-ui-fg-muted mt-1 text-left"
          >
            Remove image
          </button>
        )}
      </div>

      {/* Next Tier */}
      <div className="flex flex-col gap-y-2">
        <p className="text-ui-fg-base text-sm font-medium">Next Tier CTA</p>
        <p className="text-ui-fg-subtle text-xs">
          Shown at the bottom of the collection page to guide shoppers to the next tier. Leave blank to hide.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="next_tier_label" size="small">
              Label
            </Label>
            <Input
              id="next_tier_label"
              name="next_tier_label"
              placeholder="e.g. Ready for More?"
              value={details.next_tier_label}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="next_tier_href" size="small">
              Link (href)
            </Label>
            <Input
              id="next_tier_href"
              name="next_tier_href"
              placeholder="e.g. /categories/unique"
              value={details.next_tier_href}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="next_tier_cta" size="small">
              Button Text
            </Label>
            <Input
              id="next_tier_cta"
              name="next_tier_cta"
              placeholder="e.g. EXPLORE UNIQUE"
              value={details.next_tier_cta}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="small"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Tier Details"}
        </Button>
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product_category.details.after",
})

export default CategoryTierDetailsWidget
