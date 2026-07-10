import { uploadFilesWorkflow } from "@medusajs/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import { findPerenualSpeciesWithImage } from "../perenual/client"
import { optimizeImageForUpload } from "../../utils/optimize-image"
import { slugifyNoteName } from "../fragrance-notes/utils"

export async function downloadOptimizeAndUploadNoteImage(
  container: MedusaContainer,
  remoteUrl: string,
  noteName: string
): Promise<string> {
  const res = await fetch(remoteUrl)
  if (!res.ok) {
    throw new Error(`Failed to download plant image (${res.status})`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const optimized = await optimizeImageForUpload(
    buffer,
    `${slugifyNoteName(noteName)}.jpg`,
    "image/jpeg",
    { maxWidth: 320, maxHeight: 320, quality: 82 }
  )

  const { result } = await uploadFilesWorkflow(container).run({
    input: {
      files: [
        {
          filename: `fragrance-notes/${slugifyNoteName(noteName)}.webp`,
          mimeType: optimized.mimeType,
          content: optimized.buffer.toString("base64"),
          access: "public",
        },
      ],
    },
  })

  const uploaded = result?.[0]
  const url = uploaded?.url ?? (uploaded as { file_url?: string })?.file_url
  if (!url) {
    throw new Error("Upload succeeded but no file URL was returned")
  }

  return url
}

export async function fetchPerenualImageForNote(
  container: MedusaContainer,
  noteName: string
): Promise<{
  image_url: string
  perenual_species_id: number
  plant_query: string
}> {
  const match = await findPerenualSpeciesWithImage(noteName)
  if (!match) {
    throw new Error(
      `No plant image found on Perenual for "${noteName}". Attach one manually.`
    )
  }

  const image_url = await downloadOptimizeAndUploadNoteImage(
    container,
    match.imageUrl,
    noteName
  )

  return {
    image_url,
    perenual_species_id: match.species.id,
    plant_query: match.query,
  }
}
