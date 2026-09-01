import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { isCaAdminRole } from "../../lib/admin/roles"

const CA_BODY_CLASS = "ca-admin-only"
const CA_STYLE_ID = "ca-admin-styles"

/** Client routes a CA account may open in the admin UI. */
export const CA_ADMIN_UI_ROUTES = ["/gst-filing"]

const PUBLIC_ADMIN_ROUTES = ["/login", "/invite", "/reset-password"]

function injectCaAdminStyles() {
  if (document.getElementById(CA_STYLE_ID)) {
    return
  }

  const style = document.createElement("style")
  style.id = CA_STYLE_ID
  style.textContent = `
    body.${CA_BODY_CLASS} aside > div > div.flex.flex-1.flex-col.justify-between > div > div.flex.flex-1.flex-col > nav {
      display: none !important;
    }
    body.${CA_BODY_CLASS} aside a[href="/settings"],
    body.${CA_BODY_CLASS} aside a[href="/settings/store"],
    body.${CA_BODY_CLASS} a[href="/settings/profile"] {
      display: none !important;
    }
    body.${CA_BODY_CLASS} aside nav a[href]:not([href="/gst-filing"]) {
      display: none !important;
    }
    body.${CA_BODY_CLASS} aside nav a[href="/gst-filing"] {
      display: flex !important;
    }
  `
  document.head.appendChild(style)
}

function isPublicAdminRoute(pathname: string): boolean {
  return PUBLIC_ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}?`)
  )
}

function isCaUiRouteAllowed(pathname: string): boolean {
  return CA_ADMIN_UI_ROUTES.some((route) => pathname.startsWith(route))
}

type UsersMeResponse = {
  user?: { metadata?: Record<string, unknown> | null }
}

/**
 * Redirect CA logins to GST Filing and hide other sidebar items.
 * Safe to call on every admin page — no-op for full admin users.
 */
export function useCaAccessGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isCa, setIsCa] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch("/admin/users/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UsersMeResponse | null) => {
        if (cancelled) return

        const ca = isCaAdminRole(data?.user?.metadata)
        setIsCa(ca)

        if (!ca) {
          return
        }

        document.body.classList.add(CA_BODY_CLASS)
        injectCaAdminStyles()

        if (
          !isPublicAdminRoute(location.pathname) &&
          !isCaUiRouteAllowed(location.pathname)
        ) {
          navigate("/gst-filing", { replace: true })
        }
      })
      .catch(() => {
        if (!cancelled) setIsCa(false)
      })

    return () => {
      cancelled = true
    }
  }, [location.pathname, navigate])

  return { isCa, loading: isCa === null }
}
