import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { FRAGRANCE_NOTES_MODULE } from "../../../../modules/fragrance-notes"

type PatchBody = {
  display_name?: string
  image_url?: string | null
  image_source?: string | null
}

export async function PATCH(
  req: MedusaRequest<PatchBody>,
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

  const updated = await service.updateFragranceNotes({
    id,
    ...req.body,
    ...(req.body.image_url ? { image_source: req.body.image_source ?? "manual" } : {}),
  })

  res.json({ fragrance_note: updated })
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(FRAGRANCE_NOTES_MODULE) as any
  await service.deleteFragranceNotes(id)
  res.json({ id, deleted: true })
}
