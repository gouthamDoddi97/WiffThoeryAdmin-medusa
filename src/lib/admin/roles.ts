export const ADMIN_ROLE_KEY = "admin_role"
export const ADMIN_ROLE_CA = "ca"

export type AdminRole = typeof ADMIN_ROLE_CA

export function isCaAdminRole(
  metadata?: Record<string, unknown> | null
): boolean {
  return metadata?.[ADMIN_ROLE_KEY] === ADMIN_ROLE_CA
}

/** API paths a CA login may call (prefix or exact match). */
export const CA_ADMIN_API_ALLOWLIST: RegExp[] = [
  /^\/admin\/gst-filing(\/|$)/,
  /^\/admin\/users\/me$/,
  /^\/admin\/stores(\/|$)/,
]

export function isCaAdminApiPathAllowed(path: string, _method: string): boolean {
  return CA_ADMIN_API_ALLOWLIST.some((pattern) => pattern.test(path))
}
