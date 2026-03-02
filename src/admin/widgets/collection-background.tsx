import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Heading, Input, Label, Select, toast } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

type CollectionBackground = {
  file_url: string
  mobile_image_url: string
  badge: string
  description: string
  font_color_palette: string
}

const defaultBackground: CollectionBackground = {
  file_url: "",
  mobile_image_url: "",
  badge: "",
  description: "",
  font_color_palette: "light",
}

type AdminCollection = {
  id: string
  title: string
}

const CollectionBackgroundWidget = ({ data }: { data: AdminCollection }) => {
  const [background, setBackground] = useState<CollectionBackground>(defaultBackground)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingMobile, setUploadingMobile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mobileFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/admin/collections/${data.id}/background`, { credentials: "include" })
      .then((r) => r.json())
      .then(({ collection_background }) => {
        if (collection_background) {
          setBackground({
            file_url: collection_background.file_url ?? "",
            mobile_image_url: collection_background.mobile_image_url ?? "",
            badge: collection_background.badge ?? "",
            description: collection_background.description ?? "",
            font_color_palette: collection_background.font_color_palette ?? "light",
          })
        }
      })
      .finally(() => setLoading(false))
  }, [data.id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setBackground((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "file_url" | "mobile_image_url" = "file_url") => {
    const file = e.target.files?.[0]
    if (!file) return

    const isVideo = file.type.startsWith("video/") || file.name.endsWith(".webm")
    const isImage = file.type.startsWith("image/")
    if (!isVideo && !isImage) {
      toast.error("Only image or .webm video files are supported")
      return
    }

    const isMobile = field === "mobile_image_url"
    isMobile ? setUploadingMobile(true) : setUploading(true)
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
      const fileUrl: string = files?.[0]?.url ?? files?.[0]?.file_url ?? ""

      if (!fileUrl) throw new Error("No file URL returned")

      setBackground((prev) => ({ ...prev, [field]: fileUrl }))
      toast.success("File uploaded — click Save to persist")
    } catch (err) {
      toast.error("Upload failed")
    } finally {
      isMobile ? setUploadingMobile(false) : setUploading(false)
      const ref = isMobile ? mobileFileInputRef : fileInputRef
      if (ref.current) ref.current.value = ""
    }
  }

  const handleSave = async () => {
    if (!background.file_url) {
      toast.error("Please upload an image or video first")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/admin/collections/${data.id}/background`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(background),
      })
      if (!res.ok) throw new Error("Save failed")
      toast.success("Collection background saved")
    } catch {
      toast.error("Failed to save background")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/admin/collections/${data.id}/background`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Delete failed")
      setBackground(defaultBackground)
      toast.success("Background removed")
    } catch {
      toast.error("Failed to remove background")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6">
        <p className="text-ui-fg-subtle text-sm">Loading background…</p>
      </div>
    )
  }

  return (
    <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6 flex flex-col gap-y-6">
      <Heading level="h2">Hero Carousel Background</Heading>

      {/* Current media preview */}
      {background.file_url && (
        <div className="flex flex-col gap-y-2">
          <Label>Current background</Label>
          {background.file_url.endsWith(".webm") ||
          background.file_url.includes("video") ? (
            <video
              src={background.file_url}
              className="w-full rounded-lg max-h-40 object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              src={background.file_url}
              alt="Collection background"
              className="w-full rounded-lg max-h-40 object-cover"
            />
          )}
          <p className="text-ui-fg-subtle text-xs break-all">{background.file_url}</p>
        </div>
      )}

      {/* Upload */}
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="bg-upload">Upload image or .webm video</Label>
        <input
          id="bg-upload"
          ref={fileInputRef}
          type="file"
          accept="image/*,video/webm,.webm"
          onChange={(e) => handleFileUpload(e, "file_url")}
          disabled={uploading}
          className="text-sm text-ui-fg-base file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-ui-bg-subtle file:text-ui-fg-base hover:file:bg-ui-bg-base cursor-pointer"
        />
        {uploading && (
          <p className="text-ui-fg-subtle text-xs">Uploading…</p>
        )}
      </div>

      {/* Mobile image */}
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="mobile-upload">Mobile background (portrait image or .webm, shown on small screens)</Label>
        {background.mobile_image_url && (
          <img
            src={background.mobile_image_url}
            alt="Mobile background"
            className="w-32 rounded-lg object-cover"
          />
        )}
        <input
          id="mobile-upload"
          ref={mobileFileInputRef}
          type="file"
          accept="image/*,video/webm,.webm"
          onChange={(e) => handleFileUpload(e, "mobile_image_url")}
          disabled={uploadingMobile}
          className="text-sm text-ui-fg-base file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-ui-bg-subtle file:text-ui-fg-base hover:file:bg-ui-bg-base cursor-pointer"
        />
        {uploadingMobile && (
          <p className="text-ui-fg-subtle text-xs">Uploading…</p>
        )}
      </div>

      {/* Badge */}
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="bg-badge">Badge text</Label>
        <Input
          id="bg-badge"
          name="badge"
          value={background.badge}
          onChange={handleChange}
          placeholder="e.g. Designer's Pick"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="bg-description">Description</Label>
        <Input
          id="bg-description"
          name="description"
          value={background.description}
          onChange={handleChange}
          placeholder="Short collection description for the slide"
        />
      </div>

      {/* Font color palette */}
      <div className="flex flex-col gap-y-2">
        <Label>Text colour on slide</Label>
        <Select
          value={background.font_color_palette}
          onValueChange={(val) =>
            setBackground((prev) => ({ ...prev, font_color_palette: val }))
          }
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="light">Light (white text)</Select.Item>
            <Select.Item value="dark">Dark (dark text)</Select.Item>
          </Select.Content>
        </Select>
      </div>

      <div className="flex gap-x-3">
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={saving}
          disabled={saving || uploading}
        >
          Save
        </Button>
        {background.file_url && (
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleting}
            disabled={deleting}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product_collection.details.after",
})

export default CollectionBackgroundWidget
