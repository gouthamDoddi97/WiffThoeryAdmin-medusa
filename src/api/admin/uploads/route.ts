import { uploadFilesWorkflow } from "@medusajs/core-flows"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { HttpTypes } from "@medusajs/framework/types"
import { optimizeImageForUpload, ADMIN_UPLOAD_IMAGE_OPTIONS } from "../../../utils/optimize-image"

export async function POST(
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUploadFile>,
  res: MedusaResponse<HttpTypes.AdminFileListResponse>
): Promise<void> {
  const input = req.files as Express.Multer.File[] | undefined

  if (!input?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files were uploaded"
    )
  }

  const files = await Promise.all(
    input.map(async (file) => {
      const optimized = await optimizeImageForUpload(
        file.buffer,
        file.originalname,
        file.mimetype,
        ADMIN_UPLOAD_IMAGE_OPTIONS
      )

      return {
        filename: optimized.filename,
        mimeType: optimized.mimeType,
        content: optimized.buffer.toString("base64"),
        access: "public" as const,
      }
    })
  )

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: { files },
  })

  res.status(200).json({ files: result })
}
