import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { COLLECTION_BACKGROUND_MODULE } from "../../../../../modules/collection-background"
import CollectionBackgroundModuleService from "../../../../../modules/collection-background/service"

type BackgroundBody = {
  file_url: string
  mobile_image_url?: string
  badge?: string
  description?: string
  font_color_palette?: string
}

async function revalidateCollections() {
  const frontendUrl = process.env.STOREFRONT_URL?.replace(/\/+$/, "")
  const secret = process.env.REVALIDATE_SECRET
  if (!frontendUrl || !secret) return
  try {
    await fetch(`${frontendUrl}/api/revalidate/collections`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret },
    })
  } catch (e) {
    console.error("Failed to revalidate collections cache", e)
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: CollectionBackgroundModuleService =
    req.scope.resolve(COLLECTION_BACKGROUND_MODULE)

  const [background] = await service.listCollectionBackgrounds({ collection_id: id })
  res.json({ collection_background: background ?? null })
}

export async function POST(
  req: MedusaRequest<BackgroundBody>,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: CollectionBackgroundModuleService =
    req.scope.resolve(COLLECTION_BACKGROUND_MODULE)

  const { file_url, mobile_image_url, badge, description, font_color_palette } = req.body

  const [existing] = await service.listCollectionBackgrounds({ collection_id: id })

  let background
  if (existing) {
    background = await service.updateCollectionBackgrounds({
      id: existing.id,
      file_url,
      mobile_image_url,
      badge,
      description,
      font_color_palette,
    })
  } else {
    background = await service.createCollectionBackgrounds({
      collection_id: id,
      file_url,
      mobile_image_url,
      badge,
      description,
      font_color_palette,
    })
  }

  res.json({ collection_background: background })
  await revalidateCollections()
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service: CollectionBackgroundModuleService =
    req.scope.resolve(COLLECTION_BACKGROUND_MODULE)

  const [existing] = await service.listCollectionBackgrounds({ collection_id: id })

  if (existing) {
    await service.deleteCollectionBackgrounds(existing.id)
  }

  res.json({ deleted: true })
  await revalidateCollections()
}
