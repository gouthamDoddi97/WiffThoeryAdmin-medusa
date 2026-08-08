export type PackingLabelMetadata = {
  ready_at?: string
  order_barcode?: string
  awb?: string
  label_version?: number
}

export function getPackingLabelMeta(
  metadata?: Record<string, unknown> | null
): PackingLabelMetadata {
  const raw = metadata?.packing_label
  if (!raw || typeof raw !== "object") {
    return {}
  }
  return raw as PackingLabelMetadata
}

export function isPackingLabelReady(
  metadata?: Record<string, unknown> | null
): boolean {
  return Boolean(getPackingLabelMeta(metadata).ready_at)
}

export function orderChannelBarcode(displayId: number | string): string {
  return `WT-${displayId}`
}

export function shouldRequirePackingLabel(
  metadata?: Record<string, unknown> | null
): boolean {
  if (metadata?.offline_sale) {
    return false
  }
  return true
}
