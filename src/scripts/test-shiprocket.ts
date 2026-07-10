import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

const API_BASE = "https://apiv2.shiprocket.in/v1/external"

function loadStorefrontEnv() {
  const envPath = resolve(
    process.cwd(),
    "../whiff-theory-storefront/.env.local"
  )
  if (!existsSync(envPath)) {
    return
  }
  const text = readFileSync(envPath, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }
    const eq = trimmed.indexOf("=")
    if (eq === -1) {
      continue
    }
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function getShiprocketPassword() {
  return (
    process.env.SHIPROCKET_PASSWORD ??
    process.env.SHIPROCKET_API_KEY ??
    process.env.NEXT_SHIPROCKET_API_KEY
  )
}

async function tryLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.text()
  return { ok: res.ok, status: res.status, body }
}

async function tryBearer(path: string, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.text()
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) }
}

export default async function testShiprocket({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  loadStorefrontEnv()

  const email = process.env.SHIPROCKET_EMAIL
  const password = getShiprocketPassword()

  logger.info("── Shiprocket API test ──")
  logger.info(`Docs: https://apidocs.shiprocket.in/`)

  if (!password) {
    logger.error(
      "Missing password. Set SHIPROCKET_PASSWORD or SHIPROCKET_API_KEY in whiff-theory/.env"
    )
    return
  }

  if (!email) {
    logger.warn(
      "SHIPROCKET_EMAIL is not set. Shiprocket auth requires the API user email + password (not login email)."
    )
    logger.warn(
      "Panel: Settings → API → Configure → your API user email."
    )

    const asToken = await tryBearer("/settings/company/pickup", password)
    logger.info(
      `Direct Bearer test (treating key as JWT): ${asToken.status} ${asToken.ok ? "OK" : "FAILED"}`
    )
    if (!asToken.ok) {
      logger.error(
        "API key alone is not a Bearer token. Add SHIPROCKET_EMAIL to whiff-theory/.env and re-run."
      )
    }
    return
  }

  const login = await tryLogin(email, password)
  if (!login.ok) {
    logger.error(`Auth failed (${login.status}): ${login.body}`)
    logger.warn(
      "Use API user credentials from Settings → API, not your Shiprocket login password."
    )
    return
  }

  let token: string
  try {
    token = JSON.parse(login.body).token
  } catch {
    logger.error("Auth response missing token JSON")
    return
  }

  logger.info("✓ Auth OK — token received")

  const pickup = await tryBearer("/settings/company/pickup", token)
  if (pickup.ok) {
    logger.info("✓ Pickup locations fetched")
    try {
      const data = JSON.parse(pickup.body)
      const locations = data?.data?.shipping_address ?? data?.data ?? data
      if (Array.isArray(locations)) {
        for (const loc of locations.slice(0, 5)) {
          logger.info(
            `  • ${loc.pickup_location ?? loc.name ?? "location"} (pin: ${loc.pin_code ?? loc.pincode ?? "?"})`
          )
        }
      } else {
        logger.info(`  Response preview: ${pickup.body.slice(0, 200)}`)
      }
    } catch {
      logger.info(`  ${pickup.body.slice(0, 200)}`)
    }
  } else {
    logger.warn(`Pickup locations failed (${pickup.status}): ${pickup.body}`)
  }

  const serviceability = await fetch(
    `${API_BASE}/courier/serviceability/?pickup_postcode=530001&delivery_postcode=110001&cod=0&weight=0.35`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const svcBody = await serviceability.text()
  if (serviceability.ok) {
    logger.info("✓ Courier serviceability check OK (530001 → 110001)")
  } else {
    logger.warn(
      `Serviceability check (${serviceability.status}): ${svcBody.slice(0, 200)}`
    )
  }

  logger.info(
    "Done. Set SHIPROCKET_DEMO_MODE=false and SHIPROCKET_PICKUP_LOCATION=<exact name> in whiff-theory/.env for live orders."
  )
}
