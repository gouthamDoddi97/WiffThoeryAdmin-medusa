import { toast } from "@medusajs/ui"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { isCaAdminRole, getCaAdminStoreStub } from "../../lib/admin/roles"

const CA_BODY_CLASS = "ca-admin-only"
const CA_STYLE_ID = "ca-admin-styles"
export const CA_SESSION_KEY = "whiff_ca_admin"
export const CA_GST_ROUTE = "/gst-filing"

/** Client routes a CA account may open in the admin UI. */
export const CA_ADMIN_UI_ROUTES = [CA_GST_ROUTE]

const PUBLIC_ADMIN_ROUTES = ["/login", "/invite", "/reset-password"]

declare global {
  interface Window {
    __whiffCaBootstrap?: boolean
  }
}

function adminBasePath(): string {
  return window.location.pathname.startsWith("/app") ? "/app" : ""
}

export function redirectToGstFilingHard() {
  const target = `${adminBasePath()}${CA_GST_ROUTE}`
  if (!window.location.pathname.includes(CA_GST_ROUTE)) {
    window.location.assign(target)
  }
}

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
    body.${CA_BODY_CLASS} aside nav a[href="/gst-filing"] {
      display: flex !important;
    }
    body.${CA_BODY_CLASS} aside nav a[href]:not([href="/gst-filing"]) {
      display: none !important;
    }
    body.${CA_BODY_CLASS} [data-radix-dialog-overlay] {
      display: none !important;
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

function applyCaShell() {
  document.body.classList.add(CA_BODY_CLASS)
  injectCaAdminStyles()
}

function redirectCaAway(
  pathname: string,
  navigate: ReturnType<typeof useNavigate>,
  toastPathRef: { current: string | null }
) {
  if (isPublicAdminRoute(pathname) || isCaUiRouteAllowed(pathname)) {
    return
  }

  if (toastPathRef.current !== pathname) {
    toastPathRef.current = pathname
    toast.info("This account only has access to GST Filing.")
  }

  navigate(CA_GST_ROUTE, { replace: true })
}

/** Run once at admin startup + on login. */
export function installCaAdminBootstrap() {
  if (typeof window === "undefined" || window.__whiffCaBootstrap) {
    return
  }

  window.__whiffCaBootstrap = true

  if (sessionStorage.getItem(CA_SESSION_KEY) === "1") {
    applyCaShell()
    if (!window.location.pathname.includes(CA_GST_ROUTE)) {
      redirectToGstFilingHard()
    }
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const method = (init?.method ?? "GET").toUpperCase()

    if (url.includes("/auth/user/emailpass") && method === "POST") {
      const response = await originalFetch(input, init)

      if (response.ok) {
        try {
          const meRes = await originalFetch("/admin/users/me", {
            credentials: "include",
          })
          if (meRes.ok) {
            const data = (await meRes.json()) as {
              user?: { metadata?: Record<string, unknown> | null }
            }
            if (isCaAdminRole(data?.user?.metadata)) {
              sessionStorage.setItem(CA_SESSION_KEY, "1")
              applyCaShell()
              redirectToGstFilingHard()
              return new Promise<Response>(() => {
                /* block login onSuccess navigate to /orders */
              })
            }
          }
        } catch {
          // fall through
        }
      }

      return response
    }

    const isCaSession = sessionStorage.getItem(CA_SESSION_KEY) === "1"
    const isStoresListGet =
      method === "GET" &&
      /\/admin\/stores(?:\?|$)/.test(url.replace(/^https?:\/\/[^/]+/, ""))

    const response = await originalFetch(
      input,
      isCaSession && isStoresListGet
        ? { ...init, cache: "no-store" }
        : init
    )

    if (isCaSession && isStoresListGet) {
      try {
        const data = (await response.clone().json()) as {
          stores?: unknown[]
        }
        if (!data.stores?.[0]) {
          return new Response(JSON.stringify(getCaAdminStoreStub()), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          })
        }
      } catch {
        return new Response(JSON.stringify(getCaAdminStoreStub()), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        })
      }
    }

    if (url.includes("/auth/session") && method === "DELETE" && response.ok) {
      sessionStorage.removeItem(CA_SESSION_KEY)
      document.body.classList.remove(CA_BODY_CLASS)
    }

    return response
  }
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
  const redirectToastPath = useRef<string | null>(null)
  const [isCa, setIsCa] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem(CA_SESSION_KEY) === "1" ? true : null
  })

  installCaAdminBootstrap()

  useLayoutEffect(() => {
    if (sessionStorage.getItem(CA_SESSION_KEY) !== "1") {
      return
    }

    applyCaShell()
    redirectCaAway(location.pathname, navigate, redirectToastPath)
  }, [location.pathname, navigate])

  useEffect(() => {
    let cancelled = false

    fetch("/admin/users/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UsersMeResponse | null) => {
        if (cancelled) return

        const ca = isCaAdminRole(data?.user?.metadata)
        setIsCa(ca)

        if (!ca) {
          sessionStorage.removeItem(CA_SESSION_KEY)
          document.body.classList.remove(CA_BODY_CLASS)
          return
        }

        sessionStorage.setItem(CA_SESSION_KEY, "1")
        applyCaShell()
        redirectCaAway(location.pathname, navigate, redirectToastPath)
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

// Load bootstrap as soon as this module is imported by the admin bundle.
installCaAdminBootstrap()
