function isLocalhost(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url)
}

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "")
}

/** Medusa admin UI lives at `{backend}/app`. */
export function resolveAdminAppUrl(): string {
  const candidates = [
    process.env.ADMIN_URL,
    process.env.MEDUSA_BACKEND_URL,
    process.env.PUBLIC_MEDUSA_BACKEND_URL,
    railwayPublicUrl(),
    firstPublicOrigin(process.env.ADMIN_CORS),
  ]
    .filter(Boolean)
    .map((value) => String(value))

  for (const candidate of candidates) {
    const url = toAdminAppUrl(candidate)
    if (!isLocalhost(url)) return url
  }

  for (const candidate of candidates) {
    return toAdminAppUrl(candidate)
  }

  return "http://localhost:9000/app"
}

export function adminBudgetUrl(): string {
  return `${resolveAdminAppUrl()}/budget`
}

function railwayPublicUrl(): string | null {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
  if (!domain) return null
  return domain.startsWith("http") ? domain : `https://${domain}`
}

function firstPublicOrigin(cors?: string): string | null {
  if (!cors) return null
  for (const part of cors.split(",")) {
    const origin = normalizeOrigin(part)
    if (origin.startsWith("http") && !isLocalhost(origin)) {
      return origin
    }
  }
  return null
}

function toAdminAppUrl(raw: string): string {
  const origin = normalizeOrigin(raw)
  if (origin.endsWith("/app")) return origin
  return `${origin}/app`
}
