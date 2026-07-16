import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo } from "@medusajs/icons"
import { Button, Heading, Input, Label, toast } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

type FragranceNote = {
  id: string
  name: string
  display_name: string
  image_url?: string | null
  plant_query?: string | null
  image_source?: string | null
}

const FragranceNotesPage = () => {
  const [notes, setNotes] = useState<FragranceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = () => {
    fetch("/admin/fragrance-notes", { credentials: "include" })
      .then((r) => r.json())
      .then(({ fragrance_notes }) => setNotes(fragrance_notes ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const pending = notes.filter((n) => !n.image_url)

  const addNote = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const res = await fetch("/admin/fragrance-notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed to add note")
      setNewName("")
      load()
      toast.success(`Added "${name}"`)
    } catch {
      toast.error("Could not add note")
    }
  }

  const fetchImage = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/admin/fragrance-notes/${id}/fetch-image`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? "Fetch failed")
      toast.success("Image fetched and saved to bucket")
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const uploadManual = async (id: string, file: File) => {
    setUploadingId(id)
    try {
      const formData = new FormData()
      formData.append("files", file)
      const uploadRes = await fetch("/admin/uploads", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      if (!uploadRes.ok) throw new Error("Upload failed")
      const { files } = await uploadRes.json()
      const url = files?.[0]?.url ?? files?.[0]?.file_url
      if (!url) throw new Error("No upload URL returned")

      const patchRes = await fetch(`/admin/fragrance-notes/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url, image_source: "manual" }),
      })
      if (!patchRes.ok) throw new Error("Could not save image URL")
      toast.success("Manual image attached")
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploadingId(null)
    }
  }

  const fetchAllPending = async () => {
    for (const note of pending) {
      await fetchImage(note.id)
    }
  }

  if (loading) {
    return <p className="text-ui-fg-subtle text-sm p-6">Loading fragrance notes…</p>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level="h1">Fragrance Notes</Heading>
          <p className="text-ui-fg-muted text-sm mt-1 max-w-xl">
            Canonical note library for pyramid diagrams. Fetch each image once from
            Perenual (WebP in your bucket) — then the storefront reads from here, not
            the API.
          </p>
        </div>
        {pending.length > 0 && (
          <Button
            size="small"
            variant="secondary"
            onClick={() => void fetchAllPending()}
          >
            Auto-fetch all pending ({pending.length})
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ui-border-base p-4">
        <div className="flex flex-col gap-1 min-w-[240px] flex-1">
          <Label size="small">Add note</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Sandalwood"
            onKeyDown={(e) => e.key === "Enter" && void addNote()}
          />
        </div>
        <Button size="small" onClick={() => void addNote()}>
          Add
        </Button>
      </div>

      <div className="rounded-lg border border-ui-border-base overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ui-bg-subtle text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((note) => (
              <tr key={note.id} className="border-t border-ui-border-base">
                <td className="px-4 py-3">
                  <p className="font-medium">{note.display_name}</p>
                  <p className="text-xs text-ui-fg-muted">{note.name}</p>
                </td>
                <td className="px-4 py-3">
                  {note.image_url ? (
                    <img
                      src={note.image_url}
                      alt=""
                      className="h-12 w-12 rounded object-cover border border-ui-border-base"
                    />
                  ) : (
                    <span className="text-xs text-ui-tag-orange-text">Needs image</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ui-fg-muted">
                  {note.image_source ?? "—"}
                  {note.plant_query ? ` · ${note.plant_query}` : ""}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="small"
                      variant="secondary"
                      isLoading={busyId === note.id}
                      onClick={() => void fetchImage(note.id)}
                    >
                      {note.image_url ? "Re-fetch" : "Auto-fetch"}
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      isLoading={uploadingId === note.id}
                      onClick={() => fileRefs.current[note.id]?.click()}
                    >
                      Upload
                    </Button>
                    <input
                      ref={(el) => {
                        fileRefs.current[note.id] = el
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void uploadManual(note.id, file)
                        e.target.value = ""
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!notes.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ui-fg-muted">
                  No notes yet. Add notes here or save them on a product&apos;s perfume
                  details.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Fragrance Notes",
  icon: Photo,
})

export default FragranceNotesPage
