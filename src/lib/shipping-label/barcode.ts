import bwipjs from "bwip-js"

export async function renderCode128Barcode(
  text: string,
  options?: { height?: number; scale?: number; includeText?: boolean }
): Promise<Buffer> {
  const value = text.trim()
  if (!value) {
    throw new Error("Barcode text is required")
  }

  return bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: options?.scale ?? 2,
    height: options?.height ?? 12,
    includetext: options?.includeText ?? false,
    textxalign: "center",
  })
}
