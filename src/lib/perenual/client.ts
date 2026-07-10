const API_BASE = "https://perenual.com/api/v2"

export type PerenualImage = {
  thumbnail?: string
  small_url?: string
  medium_url?: string
  regular_url?: string
}

export type PerenualSpecies = {
  id: number
  common_name?: string
  scientific_name?: string[]
  default_image?: PerenualImage | null
}

const NOTE_TO_QUERY: [RegExp, string][] = [
  [/saffron|crocus/i, "crocus"],
  [/passion\s*fruit|passionfruit/i, "passion fruit"],
  [/rose|peony|jasmine|ylang/i, "rose"],
  [/oud|agarwood/i, "agarwood"],
  [/sandalwood/i, "sandalwood"],
  [/cedar|vetiver|patchouli/i, "cedar"],
  [/vanilla|tonka/i, "vanilla"],
  [/ambergris|musk/i, ""],
  [/amber|benzoin|labdanum|frankincense|myrrh|incense/i, "frankincense"],
  [/lemon\s*verbena|verbena/i, "lemon verbena"],
  [/lemon|bergamot|citrus|orange|grapefruit|lime/i, "citrus"],
  [/mint|peppermint|eucalyptus|basil/i, "mint"],
  [/violet/i, "violet"],
  [/lavender|iris/i, "iris"],
  [/wood/i, "sandalwood"],
]

const QUERY_FALLBACKS: Record<string, string[]> = {
  sandalwood: ["sandalwood", "santalum album", "santalum", "sandal"],
  agarwood: ["agarwood", "aquilaria", "oud"],
  cedar: ["cedar", "cedrus"],
  frankincense: ["frankincense", "boswellia"],
  "lemon verbena": ["lemon verbena", "verbena"],
  violet: ["violet", "viola"],
  iris: ["iris", "iris flower"],
  mint: ["mint", "peppermint", "mentha"],
  citrus: ["citrus", "lemon"],
  crocus: ["crocus", "saffron crocus"],
  rose: ["rose", "rosa"],
  vanilla: ["vanilla", "vanilla orchid"],
}

export function plantQueriesForNote(noteName: string): string[] {
  const normalized = noteName.trim().toLowerCase()
  for (const [pattern, query] of NOTE_TO_QUERY) {
    if (pattern.test(normalized)) {
      if (!query) return []
      const fallbacks = QUERY_FALLBACKS[query] ?? [query]
      return Array.from(new Set(fallbacks))
    }
  }
  return [noteName.trim()]
}

function getApiKey(): string | null {
  return process.env.NEXT_PLANT_DOCS_API_KEY ?? null
}

function bestImageUrl(image?: PerenualImage | null): string | null {
  if (!image) return null
  return (
    image.regular_url ??
    image.medium_url ??
    image.small_url ??
    image.thumbnail ??
    null
  )
}

export async function searchPerenualSpecies(
  query: string
): Promise<PerenualSpecies[]> {
  const key = getApiKey()
  if (!key || !query.trim()) return []

  const url = new URL(`${API_BASE}/species-list`)
  url.searchParams.set("key", key)
  url.searchParams.set("q", query)

  const res = await fetch(url.toString())
  if (!res.ok) return []

  const json = await res.json()
  return (json.data ?? []) as PerenualSpecies[]
}

export async function findPerenualSpeciesWithImage(
  noteName: string
): Promise<{ species: PerenualSpecies; imageUrl: string; query: string } | null> {
  const queries = plantQueriesForNote(noteName)

  for (const query of queries) {
    const results = await searchPerenualSpecies(query)
    for (const species of results) {
      const imageUrl = bestImageUrl(species.default_image)
      if (imageUrl) {
        return { species, imageUrl, query }
      }
    }
  }

  return null
}
