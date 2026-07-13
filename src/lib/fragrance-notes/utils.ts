/** Normalize a note name for deduplicated storage and lookup. */
export function normalizeNoteName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ")
}

export function displayNoteName(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

export function parseNoteList(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(/[,·]/)
    .flatMap((part) => part.split(/\band\b/i))
    .map((n) => n.trim().replace(/[.!?]+$/, "").trim())
    .filter(Boolean)
}

export function slugifyNoteName(name: string): string {
  return normalizeNoteName(name).replace(/\s+/g, "-")
}
