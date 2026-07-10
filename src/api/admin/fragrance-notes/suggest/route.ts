import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { FRAGRANCE_NOTES_MODULE } from "../../../../modules/fragrance-notes"
import { normalizeNoteName } from "../../../../lib/fragrance-notes/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const q = String(req.query.q ?? "").trim().toLowerCase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = req.scope.resolve(FRAGRANCE_NOTES_MODULE) as any

  const notes = await service.listFragranceNotes(
    {},
    { order: { display_name: "ASC" }, take: 500 }
  )

  const filtered = (notes ?? []).filter(
    (n: { name: string; display_name: string }) => {
      if (!q) return true
      return (
        n.name.includes(q) ||
        n.display_name.toLowerCase().includes(q) ||
        normalizeNoteName(n.display_name).includes(q)
      )
    }
  )

  res.json({
    suggestions: filtered.slice(0, 12).map(
      (n: {
        id: string
        name: string
        display_name: string
        image_url?: string | null
      }) => ({
        id: n.id,
        name: n.name,
        display_name: n.display_name,
        image_url: n.image_url ?? null,
        has_image: Boolean(n.image_url),
      })
    ),
  })
}
