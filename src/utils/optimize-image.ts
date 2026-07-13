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

/** General admin uploads — product media, collections, offers, UGC, etc. */
export const ADMIN_UPLOAD_IMAGE_OPTIONS: OptimizeImageOptions = {
  maxWidth: 2400,
  maxHeight: 2400,
  quality: 82,
}

/** Small botanical thumbnails for fragrance-note library */
export const NOTE_IMAGE_OPTIONS: OptimizeImageOptions = {
  maxWidth: 320,
  maxHeight: 320,
  quality: 82,
}

const CONVERTIBLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
])

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tiff: "image/tiff",
  tif: "image/tiff",
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
}

function webpFilename(originalFilename: string): string {
  const baseName = originalFilename.replace(/\.[^.]+$/, "") || "image"
  return `${baseName}.webp`
}

function resolveMimeType(filename: string, mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(";")[0].trim()
  if (CONVERTIBLE_MIME_TYPES.has(normalized)) {
    return normalized
  }

  const ext = filename.toLowerCase().split(".").pop() ?? ""
  return EXTENSION_TO_MIME[ext] ?? normalized
}

function shouldConvert(mimeType: string): boolean {
  return CONVERTIBLE_MIME_TYPES.has(mimeType)
}

export async function optimizeImageForUpload(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImage> {
  const resolvedMime = resolveMimeType(originalFilename, mimeType)

  if (!shouldConvert(resolvedMime)) {
    return {
      buffer,
      mimeType: resolvedMime || mimeType,
      filename: originalFilename,
    }
  }

  const { maxWidth, maxHeight, quality = 80 } = options

  try {
    let pipeline = sharp(buffer, { animated: false }).rotate()

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
  } catch (error) {
    console.warn(
      `[optimize-image] WebP conversion failed for "${originalFilename}", uploading original:`,
      error instanceof Error ? error.message : error
    )

    return {
      buffer,
      mimeType: resolvedMime || mimeType,
      filename: originalFilename,
    }
  }
}

export async function prepareMulterFileForUpload(
  file: Express.Multer.File,
  options: OptimizeImageOptions = ADMIN_UPLOAD_IMAGE_OPTIONS
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
