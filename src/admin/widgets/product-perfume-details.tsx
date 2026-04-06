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
  sillage: string
  longevity: string
  occasions: string
  scent_weight: number
  caption: string
  fg_preset: string
  bg2_preset: string
}

const FG_PRESET_OPTIONS = [
  { value: "rise-up",  label: "Rise Up",  description: "Image 2 rises from below, always opaque" },
  { value: "drift-in", label: "Drift In", description: "Image 2 drifts in from the right, always opaque" },
  { value: "slide-in", label: "Slide In", description: "Image 2 slides in from the right with a fade" },
  { value: "sweep-in", label: "Sweep In", description: "Image 2 sweeps in from the far right" },
  { value: "bloom-up", label: "Bloom Up", description: "Image 2 floats up from below with a soft fade" },
  { value: "swing-in", label: "Swing In", description: "Image 2 swings in with a slight rotation" },
] as const

const BG2_PRESET_OPTIONS = [
  { value: "dissolve-over", label: "Dissolve Over", description: "Image 3 crossfades over the current view" },
  { value: "veil-fall",     label: "Veil Fall",     description: "Image 3 descends from above like a curtain" },
  { value: "zoom-through",  label: "Zoom Through",  description: "Image 3 punches in from an oversized scale" },
  { value: "push-over",     label: "Push Over",     description: "Image 1 slides left as image 3 enters from the right" },
] as const

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
  sillage: "",
  longevity: "",
  occasions: "",
  scent_weight: 5,
  caption: "",
  fg_preset: "rise-up",
  bg2_preset: "dissolve-over",
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
            sillage: perfume_details.sillage ?? "",
            longevity: perfume_details.longevity ?? "",
            occasions: perfume_details.occasions ?? "",
            scent_weight: perfume_details.scent_weight ?? 5,
            caption: perfume_details.caption ?? "",
            fg_preset:  perfume_details.fg_preset  ?? "rise-up",
            bg2_preset: perfume_details.bg2_preset ?? "dissolve-over",
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

  const handleSelectChange = (name: keyof PerfumeDetails, value: string) => {
    setDetails((prev) => ({ ...prev, [name]: value }))
  }

  const handleOccasionToggle = (value: string) => {
    setDetails((prev) => {
      const current = prev.occasions.split(",").map((s) => s.trim()).filter(Boolean)
      const updated = current.includes(value)
        ? current.filter((o) => o !== value)
        : [...current, value]
      return { ...prev, occasions: updated.join(",") }
    })
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

      {/* Caption */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="caption" size="small">Caption</Label>
        <Input
          id="caption"
          name="caption"
          placeholder="e.g. Sweet fruity with amber base"
          value={details.caption}
          onChange={handleChange}
        />
        <p className="text-ui-fg-muted text-xs">Short one-line description shown on product cards</p>
      </div>

      {/* Image 2 Transition (fg preset) */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="fg_preset" size="small">Image 2 Transition</Label>
        <select
          id="fg_preset"
          name="fg_preset"
          value={details.fg_preset}
          onChange={(e) => handleSelectChange("fg_preset", e.target.value)}
          className="h-9 w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-1 text-sm text-ui-fg-base focus:outline-none focus:ring-1 focus:ring-ui-border-interactive"
        >
          {FG_PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-ui-fg-muted text-xs">How the second image enters the scene.</p>
        <div className="mt-1 grid gap-1.5 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
          {FG_PRESET_OPTIONS.map((o) => (
            <div key={o.value} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ui-fg-base">{o.label}</p>
                <p className="text-xs text-ui-fg-muted leading-relaxed">{o.description}</p>
              </div>
              {details.fg_preset === o.value && (
                <span className="shrink-0 rounded-full border border-ui-border-interactive px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ui-fg-interactive">
                  Active
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Image 3 Transition (bg2 preset) */}
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="bg2_preset" size="small">Image 3 Transition</Label>
        <select
          id="bg2_preset"
          name="bg2_preset"
          value={details.bg2_preset}
          onChange={(e) => handleSelectChange("bg2_preset", e.target.value)}
          className="h-9 w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-1 text-sm text-ui-fg-base focus:outline-none focus:ring-1 focus:ring-ui-border-interactive"
        >
          {BG2_PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-ui-fg-muted text-xs">How the third image replaces the current view.</p>
        <div className="mt-1 grid gap-1.5 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
          {BG2_PRESET_OPTIONS.map((o) => (
            <div key={o.value} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ui-fg-base">{o.label}</p>
                <p className="text-xs text-ui-fg-muted leading-relaxed">{o.description}</p>
              </div>
              {details.bg2_preset === o.value && (
                <span className="shrink-0 rounded-full border border-ui-border-interactive px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ui-fg-interactive">
                  Active
                </span>
              )}
            </div>
          ))}
        </div>
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

      {/* Performance */}
      <div className="flex flex-col gap-y-2">
        <Label size="small" className="font-semibold">Performance</Label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="sillage" size="small">Sillage (Projection)</Label>
            <select
              id="sillage"
              name="sillage"
              value={details.sillage}
              onChange={(e) => handleSelectChange("sillage", e.target.value)}
              className="h-8 w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-1 text-sm text-ui-fg-base focus:outline-none focus:ring-1 focus:ring-ui-border-interactive [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            >
              <option value="" className="bg-[#1a1a1a] text-white">— Select —</option>
              <option value="low" className="bg-[#1a1a1a] text-white">Low</option>
              <option value="medium" className="bg-[#1a1a1a] text-white">Medium</option>
              <option value="high" className="bg-[#1a1a1a] text-white">High</option>
            </select>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="longevity" size="small">Longevity (Lasting Power)</Label>
            <select
              id="longevity"
              name="longevity"
              value={details.longevity}
              onChange={(e) => handleSelectChange("longevity", e.target.value)}
              className="h-8 w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-1 text-sm text-ui-fg-base focus:outline-none focus:ring-1 focus:ring-ui-border-interactive [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            >
              <option value="" className="bg-[#1a1a1a] text-white">— Select —</option>
              <option value="low" className="bg-[#1a1a1a] text-white">Low</option>
              <option value="medium" className="bg-[#1a1a1a] text-white">Medium</option>
              <option value="high" className="bg-[#1a1a1a] text-white">High</option>
            </select>
          </div>
        </div>

        {/* Scent Weight slider */}
        <div className="flex flex-col gap-y-2 pt-2">
          <div className="flex items-center justify-between">
            <Label size="small">Scent Weight</Label>
            <span className="text-xs text-ui-fg-subtle font-mono">
              {details.scent_weight} / 10 &mdash;&nbsp;
              {details.scent_weight <= 2
                ? "Very Light"
                : details.scent_weight <= 4
                ? "Light"
                : details.scent_weight <= 6
                ? "Medium"
                : details.scent_weight <= 8
                ? "Heavy"
                : "Very Heavy"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ui-fg-muted w-12 text-right">Light</span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={details.scent_weight}
              onChange={(e) =>
                setDetails((prev) => ({ ...prev, scent_weight: Number(e.target.value) }))
              }
              className="flex-1 h-1.5 rounded-full accent-ui-fg-interactive cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-ui-fg-interactive, #4FDBCC) 0%, var(--color-ui-fg-interactive, #4FDBCC) ${
                  ((details.scent_weight - 1) / 9) * 100
                }%, var(--color-ui-border-base, #3f3f3f) ${
                  ((details.scent_weight - 1) / 9) * 100
                }%, var(--color-ui-border-base, #3f3f3f) 100%)`,
              }}
            />
            <span className="text-xs text-ui-fg-muted w-12">Heavy</span>
          </div>
          <div className="flex justify-between px-12">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <span
                key={v}
                className="text-[9px] text-ui-fg-muted cursor-pointer select-none"
                onClick={() => setDetails((prev) => ({ ...prev, scent_weight: v }))}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* When To Wear */}
      <div className="flex flex-col gap-y-2">
        <Label size="small" className="font-semibold">When To Wear</Label>
        <p className="text-ui-fg-muted text-xs">Select all occasions that suit this fragrance</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([
            { value: "day", label: "Day" },
            { value: "evening", label: "Evening" },
            { value: "summer", label: "Summer" },
            { value: "winter", label: "Winter" },
            { value: "rainy", label: "Rainy" },
            { value: "office", label: "Office" },
            { value: "date", label: "Date Night" },

          ] as const).map(({ value, label }) => {
            const selected = details.occasions.split(",").map((s) => s.trim()).filter(Boolean).includes(value)
            return (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => handleOccasionToggle(value)}
                  className="h-4 w-4 rounded border-ui-border-base accent-ui-fg-interactive"
                />
                <span className="text-sm text-ui-fg-base">{label}</span>
              </label>
            )
          })}
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
