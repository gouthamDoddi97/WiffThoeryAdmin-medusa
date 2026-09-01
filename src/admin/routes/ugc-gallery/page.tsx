import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo } from "@medusajs/icons"
import { Button, Heading, Input, Label, toast } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { useCaAccessGuard } from "../../lib/ca-access"

type UgcPhoto = {
  id?: string
  image_url: string
  alt_text: string
  sort_order: number
  is_active: boolean
}

const buildDefaultSlots = (): UgcPhoto[] =>
  Array.from({ length: 5 }, (_, i) => ({
    image_url: "",
    alt_text: `Community photo ${i + 1}`,
    sort_order: i + 1,
    is_active: true,
  }))

const UgcGalleryPage = () => {
  useCaAccessGuard()

  const [slots, setSlots] = useState<UgcPhoto[]>(buildDefaultSlots())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const fileRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    fetch("/admin/ugc-gallery", { credentials: "include" })
      .then((r) => r.json())
      .then(({ ugc_gallery_photos }) => {
        const defaults = buildDefaultSlots()
        for (const photo of ugc_gallery_photos ?? []) {
          const index = Math.max(0, Math.min(4, (photo.sort_order ?? 1) - 1))
          defaults[index] = {
            id: photo.id,
            image_url: photo.image_url ?? "",
            alt_text: photo.alt_text ?? `Community photo ${index + 1}`,
            sort_order: photo.sort_order ?? index + 1,
            is_active: photo.is_active ?? true,
          }
        }
        setSlots(defaults)
      })
      .finally(() => setLoading(false))
  }, [])

  const updateSlot = (index: number, patch: Partial<UgcPhoto>) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)))
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingIndex(index)
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
      const uploadedUrl = files?.[0]?.url ?? files?.[0]?.file_url
      if (!uploadedUrl) throw new Error("No upload URL")

      updateSlot(index, { image_url: uploadedUrl, is_active: true })
      toast.success(`Photo ${index + 1} uploaded`)
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploadingIndex(null)
      if (fileRefs.current[index]) {
        fileRefs.current[index]!.value = ""
      }
    }
  }

  const handleRemove = async (index: number) => {
    const slot = slots[index]

    try {
      if (slot.id) {
        const res = await fetch(`/admin/ugc-gallery/${slot.id}`, {
          method: "DELETE",
          credentials: "include",
        })
        if (!res.ok) throw new Error("Delete failed")
      }

      updateSlot(index, {
        id: undefined,
        image_url: "",
        is_active: false,
        alt_text: `Community photo ${index + 1}`,
      })
      toast.success(`Photo ${index + 1} removed`)
    } catch {
      toast.error("Failed to remove photo")
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const slot of slots) {
        if (!slot.image_url) {
          continue
        }

        const res = await fetch("/admin/ugc-gallery", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slot),
        })

        if (!res.ok) {
          throw new Error("Failed saving one or more slots")
        }
      }
      toast.success("UGC gallery saved")
    } catch {
      toast.error("Failed to save UGC gallery")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6">
        <p className="text-ui-fg-subtle text-sm">Loading UGC gallery...</p>
      </div>
    )
  }

  return (
    <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6 flex flex-col gap-y-6">
      <div>
        <Heading level="h1">UGC Gallery</Heading>
        <p className="text-ui-fg-subtle text-sm mt-2">
          Universal storefront gallery for the home page section: "WHERE DOES YOUR WHIFF THEORY LIVE?"
        </p>
      </div>

      {slots.map((slot, index) => (
        <div key={index} className="rounded border border-ui-border-base p-4 flex flex-col gap-y-3">
          <div className="flex items-center justify-between">
            <Label size="small">Photo {index + 1}</Label>
            <span className="text-ui-fg-subtle text-xs">Sort order: {slot.sort_order}</span>
          </div>

          {slot.image_url ? (
            <img
              src={slot.image_url}
              alt={slot.alt_text || `Community photo ${index + 1}`}
              className="h-28 w-28 object-cover rounded border"
            />
          ) : (
            <div className="h-28 w-28 rounded border border-dashed border-ui-border-strong bg-ui-bg-subtle" />
          )}

          <div className="flex flex-col gap-y-2">
            <Label htmlFor={`ugc-upload-${index}`} size="small">
              Upload image
            </Label>
            <input
              id={`ugc-upload-${index}`}
              ref={(el) => {
                fileRefs.current[index] = el
              }}
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload(e, index)}
              disabled={uploadingIndex === index}
              className="text-sm text-ui-fg-base file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-ui-bg-subtle file:text-ui-fg-base hover:file:bg-ui-bg-base cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-y-1">
            <Label htmlFor={`ugc-alt-${index}`} size="small">
              Alt text
            </Label>
            <Input
              id={`ugc-alt-${index}`}
              value={slot.alt_text}
              onChange={(e) => updateSlot(index, { alt_text: e.target.value })}
              placeholder={`Community photo ${index + 1}`}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`ugc-active-${index}`}
              type="checkbox"
              checked={slot.is_active}
              onChange={(e) => updateSlot(index, { is_active: e.target.checked })}
            />
            <Label htmlFor={`ugc-active-${index}`} size="small">
              Active
            </Label>
          </div>

          <div>
            <Button variant="secondary" size="small" onClick={() => handleRemove(index)}>
              Remove photo
            </Button>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={saving}
          disabled={saving || uploadingIndex !== null}
        >
          Save UGC Gallery
        </Button>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "UGC Gallery",
  icon: Photo,
})

export const handle = {
  breadcrumb: () => "UGC Gallery",
}

export default UgcGalleryPage