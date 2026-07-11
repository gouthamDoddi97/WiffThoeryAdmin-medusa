import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { FRAGRANCE_NOTES_MODULE } from "../../../modules/fragrance-notes"
import { normalizeNoteName } from "../../../lib/fragrance-notes/utils"

type FragranceNoteRow = {
  name: string
  display_name: string
  image_url?: string | null
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const raw = String(req.query.names ?? "")
  const names = raw
    .split(",")
    .map((n) => normalizeNoteName(n))
    .filter(Boolean)

  if (!names.length) {
    res.json({ fragrance_notes: [] })
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(FRAGRANCE_NOTES_MODULE) as any
  const all = await service.listFragranceNotes({}, { take: 500 })
  const map = new Map<string, FragranceNoteRow>(
    (all ?? []).map((n: FragranceNoteRow) => [n.name, n])
  )

  const fragrance_notes = names.map((name) => {
    const note = map.get(name)
    return {
      name,
      display_name: note?.display_name ?? name,
      image_url: note?.image_url ?? null,
    }
  })

  res.json({ fragrance_notes })
}
