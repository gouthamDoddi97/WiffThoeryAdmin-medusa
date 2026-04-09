import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import type { IFileModuleService } from "@medusajs/framework/types"
import multer from "multer"

// Disable Medusa's default body parser so multer can read the stream
export const config = {
  bodyParser: false,
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true)
    else cb(new Error("Only image files are allowed"))
  },
})

function runMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (req: any, res: any, next: (err?: unknown) => void) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req, res, (err?: unknown) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    await runMiddleware(req, res, upload.single("file"))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed"
    res.status(400).json({ error: message })
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const file = (req as any).file as Express.Multer.File | undefined
  if (!file) {
    res.status(400).json({ error: "No file provided" })
    return
  }

  const fileService = req.scope.resolve<IFileModuleService>(Modules.FILE)

  const [uploaded] = await fileService.uploadFiles([
    {
      filename: file.originalname,
      mimeType: file.mimetype,
      content: file.buffer.toString("base64"),
      access: "public",
    },
  ])

  res.json({ url: uploaded.url })
}
