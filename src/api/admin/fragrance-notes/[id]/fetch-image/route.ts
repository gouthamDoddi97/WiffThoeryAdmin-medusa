import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { FRAGRANCE_NOTES_MODULE } from "../../../../../modules/fragrance-notes"
import { fetchPerenualImageForNote } from "../../../../../lib/fragrance-notes/fetch-note-image"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(FRAGRANCE_NOTES_MODULE) as any

  const [note] = await service.listFragranceNotes({ id })
  if (!note) {
    res.status(404).json({ message: "Note not found" })
    return
  }

  if (note.image_url) {
    res.json({
      fragrance_note: note,
      message: "Image already attached — skipped API fetch.",
    })
    return
  }

  try {
    const fetched = await fetchPerenualImageForNote(
      req.scope,
      note.display_name || note.name
    )

    const updated = await service.updateFragranceNotes({
      id: note.id,
      image_url: fetched.image_url,
      perenual_species_id: fetched.perenual_species_id,
      plant_query: fetched.plant_query,
      image_source: "perenual",
    })

    res.json({ fragrance_note: updated })
  } catch (e) {
    res.status(422).json({
      message: (e as Error).message,
      fragrance_note: note,
    })
  }
}
