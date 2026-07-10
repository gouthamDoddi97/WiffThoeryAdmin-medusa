import type { MedusaContainer } from "@medusajs/framework/types"
import { FRAGRANCE_NOTES_MODULE } from "../../modules/fragrance-notes"
import { PERFUME_DETAILS_MODULE } from "../../modules/perfume-details"
import PerfumeDetailsModuleService from "../../modules/perfume-details/service"
import {
  displayNoteName,
  normalizeNoteName,
  parseNoteList,
} from "./utils"
import { getWarehouseAlerts } from "../shiprocket/sync-warehouse-pickup"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NoteService = any

export async function upsertNotesFromText(
  container: MedusaContainer,
  ...fields: Array<string | null | undefined>
): Promise<void> {
  const service: NoteService = container.resolve(FRAGRANCE_NOTES_MODULE)
  const names = new Set<string>()

  for (const field of fields) {
    for (const raw of parseNoteList(field)) {
      names.add(normalizeNoteName(raw))
    }
  }

  for (const name of names) {
    const [existing] = await service.listFragranceNotes({ name })
    if (!existing) {
      await service.createFragranceNotes({
        name,
        display_name: displayNoteName(name),
        image_url: null,
        perenual_species_id: null,
        plant_query: null,
        image_source: null,
      })
    }
  }
}

export async function seedNotesFromProducts(
  container: MedusaContainer
): Promise<void> {
  const perfumeService: PerfumeDetailsModuleService =
    container.resolve(PERFUME_DETAILS_MODULE)
  const details = await perfumeService.listPerfumeDetails({}, { take: 500 })
  const fields = (details ?? []).flatMap(
    (d: {
      top_notes?: string | null
      middle_notes?: string | null
      base_notes?: string | null
    }) => [d.top_notes, d.middle_notes, d.base_notes]
  )
  if (fields.length) {
    await upsertNotesFromText(container, ...fields)
  }
}

export async function getPendingNoteAlerts(container: MedusaContainer) {
  await seedNotesFromProducts(container)

  const service: NoteService = container.resolve(FRAGRANCE_NOTES_MODULE)
  const notes = await service.listFragranceNotes(
    {},
    { take: 500, order: { display_name: "ASC" } }
  )

  const pending = (notes ?? []).filter(
    (n: { image_url?: string | null }) => !n.image_url
  )

  return {
    count: pending.length,
    items: pending.map(
      (n: { id: string; name: string; display_name: string }) => ({
        id: n.id,
        name: n.name,
        display_name: n.display_name,
      })
    ),
  }
}

export async function getDashboardAlerts(container: MedusaContainer) {
  const [notes_pending_images, warehouse_alerts] = await Promise.all([
    getPendingNoteAlerts(container),
    getWarehouseAlerts(container),
  ])

  return {
    notes_pending_images,
    warehouse_pending: {
      count: warehouse_alerts.length,
      items: warehouse_alerts,
    },
    total_count: notes_pending_images.count + warehouse_alerts.length,
  }
}
