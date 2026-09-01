export const ADMIN_ROLE_KEY = "admin_role"
export const ADMIN_ROLE_CA = "ca"

export type AdminRole = typeof ADMIN_ROLE_CA

export function isCaAdminRole(
  metadata?: Record<string, unknown> | null
): boolean {
  return metadata?.[ADMIN_ROLE_KEY] === ADMIN_ROLE_CA
}

/** Resolve admin API path from Express request fields. */
export function resolveAdminRequestPath(req: {
  path?: string
  url?: string
  originalUrl?: string
}): string {
  const candidates = [
    req.path,
    req.originalUrl?.split("?")[0],
    req.url?.split("?")[0],
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const normalized = normalizeAdminPath(candidate)
    if (normalized.startsWith("/admin/") || normalized === "/admin") {
      return normalized
    }
  }

  return normalizeAdminPath(candidates[0] ?? "")
}

/** Medusa may pass `/stores` or `/admin/stores` depending on middleware mount. */
export function normalizeAdminPath(rawPath: string): string {
  let path = rawPath.split("?")[0] || "/"

  if (path.includes("://")) {
    try {
      path = new URL(path).pathname
    } catch {
      // keep path as-is
    }
  }

  path = path.replace(/\/+$/, "") || "/"

  if (path === "/admin" || path.startsWith("/admin/")) {
    return path
  }

  return `/admin${path.startsWith("/") ? path : `/${path}`}`
}

const CA_GET_PASSTHROUGH =
  /^\/admin\/(gst-filing(\/|$)|users\/me$|feature-flags(\/|$)|stores(\/?|$))/

/** Real API access for CA — GST filing, identity, store shell, and feature flags. */
export function isCaAdminPassthroughPath(
  path: string,
  method: string,
  rawUrl = ""
): boolean {
  const combined = `${path} ${rawUrl}`.toLowerCase()

  if (combined.includes("/gst-filing")) {
    return true
  }

  if (method !== "GET") {
    return false
  }

  if (CA_GET_PASSTHROUGH.test(path)) {
    return true
  }

  return isAdminStoresPath(path, rawUrl)
}

function emptyList(key: string, limit = 20): Record<string, unknown> {
  return {
    [key]: [],
    count: 0,
    offset: 0,
    limit,
  }
}

function storeStubResponse(): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    stores: [
      {
        id: "store_ca_readonly",
        name: "Whiff Theory",
        supported_currencies: [{ currency_code: "inr", is_default: true }],
        default_sales_channel_id: null,
        default_region_id: null,
        default_location_id: null,
        metadata: {},
        created_at: now,
        updated_at: now,
      },
    ],
    count: 1,
    offset: 0,
    limit: 10,
  }
}

export function getCaAdminStoreStub(): Record<string, unknown> {
  return storeStubResponse()
}

export function isAdminStoresPath(path: string, rawUrl = ""): boolean {
  const combined = `${path} ${rawUrl}`.toLowerCase()
  return combined.includes("/stores")
}

/**
 * Safe GET payloads for Medusa admin shell (header, search, notifications).
 * Prevents React error boundaries from throwing on 403.
 */
export function caAdminSafeGetResponse(
  normalizedPath: string,
  rawUrl = ""
): Record<string, unknown> {
  if (isAdminStoresPath(normalizedPath, rawUrl)) {
    return storeStubResponse()
  }

  const listPaths: Record<string, string> = {
    "/admin/orders": "orders",
    "/admin/products": "products",
    "/admin/product-variants": "variants",
    "/admin/product-categories": "product_categories",
    "/admin/collections": "collections",
    "/admin/customers": "customers",
    "/admin/customer-groups": "customer_groups",
    "/admin/inventory-items": "inventory_items",
    "/admin/promotions": "promotions",
    "/admin/campaigns": "campaigns",
    "/admin/price-lists": "price_lists",
    "/admin/regions": "regions",
    "/admin/tax-regions": "tax_regions",
    "/admin/notifications": "notifications",
    "/admin/users": "users",
    "/admin/api-keys": "api_keys",
    "/admin/sales-channels": "sales_channels",
    "/admin/stock-locations": "stock_locations",
    "/admin/shipping-profiles": "shipping_profiles",
    "/admin/product-tags": "product_tags",
    "/admin/product-types": "product_types",
    "/admin/return-reasons": "return_reasons",
    "/admin/shipping-options": "shipping_options",
    "/admin/reservations": "reservations",
    "/admin/workflows-executions": "workflow_executions",
  }

  for (const [route, key] of Object.entries(listPaths)) {
    if (normalizedPath === route) {
      return emptyList(key, 3)
    }
  }

  if (normalizedPath === "/admin/feature-flags") {
    return { feature_flags: [] }
  }

  if (normalizedPath === "/admin/dashboard-alerts") {
    return { total_count: 0 }
  }

  return emptyList("items", 20)
}
