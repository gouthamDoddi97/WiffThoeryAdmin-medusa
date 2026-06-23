import sharp from "sharp"

export type OptimizedImage = {
  buffer: Buffer
  mimeType: string
  filename: string
}

export type OptimizeImageOptions = {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

const CONVERTIBLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/avif",
])

function webpFilename(originalFilename: string): string {
  const baseName = originalFilename.replace(/\.[^.]+$/, "") || "image"
  return `${baseName}.webp`
}

export async function optimizeImageForUpload(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImage> {
  if (!CONVERTIBLE_MIME_TYPES.has(mimeType)) {
    return {
      buffer,
      mimeType,
      filename: originalFilename,
    }
  }

  const { maxWidth, maxHeight, quality = 80 } = options

  let pipeline = sharp(buffer).rotate()

  if (maxWidth || maxHeight) {
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
  }

  const webpBuffer = await pipeline.webp({ quality }).toBuffer()

  return {
    buffer: webpBuffer,
    mimeType: "image/webp",
    filename: webpFilename(originalFilename),
  }
}

export async function prepareMulterFileForUpload(
  file: Express.Multer.File,
  options?: OptimizeImageOptions
) {
  const optimized = await optimizeImageForUpload(
    file.buffer,
    file.originalname,
    file.mimetype,
    options
  )

  return {
    filename: optimized.filename,
    mimeType: optimized.mimeType,
    content: optimized.buffer.toString("base64"),
    access: "public" as const,
  }
}
