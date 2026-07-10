import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { FRAGRANCE_NOTES_MODULE } from "../../../modules/fragrance-notes"
import {
  displayNoteName,
  normalizeNoteName,
} from "../../../lib/fragrance-notes/utils"

type CreateBody = {
  name: string
  display_name?: string
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(FRAGRANCE_NOTES_MODULE) as any
  const notes = await service.listFragranceNotes(
    {},
    { order: { display_name: "ASC" }, take: 500 }
  )
  res.json({ fragrance_notes: notes })
}

export async function POST(
  req: MedusaRequest<CreateBody>,
  res: MedusaResponse
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(FRAGRANCE_NOTES_MODULE) as any
  const rawName = req.body?.name?.trim()
  if (!rawName) {
    res.status(400).json({ message: "name is required" })
    return
  }

  const name = normalizeNoteName(rawName)
  const [existing] = await service.listFragranceNotes({ name })
  if (existing) {
    res.json({ fragrance_note: existing })
    return
  }

  const note = await service.createFragranceNotes({
    name,
    display_name: req.body.display_name?.trim() || displayNoteName(rawName),
    image_url: null,
    perenual_species_id: null,
    plant_query: null,
    image_source: null,
  })

  res.json({ fragrance_note: note })
}
