import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  ADMIN_ROLE_CA,
  ADMIN_ROLE_KEY,
} from "../lib/admin/roles"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isEmailArg(value: string): boolean {
  return (
    EMAIL_RE.test(value) &&
    !value.includes("\\") &&
    !value.includes("/") &&
    !value.includes("node_modules")
  )
}

function parseEmailPassword(): { email?: string; password?: string } {
  const argv = process.argv
  const scriptIdx = argv.findIndex((a) => a.includes("create-ca-admin-user"))
  const positional = scriptIdx >= 0 ? argv.slice(scriptIdx + 1) : []

  const email =
    positional.find(isEmailArg) ??
    argv.find(isEmailArg) ??
    process.env.CA_ADMIN_EMAIL

  if (!email) {
    return {}
  }

  const emailIndex = positional.indexOf(email)
  const passwordFromPositional =
    emailIndex >= 0 ? positional[emailIndex + 1] : undefined

  const password =
    passwordFromPositional &&
    !passwordFromPositional.includes(".ts") &&
    !passwordFromPositional.includes("node_modules")
      ? passwordFromPositional
      : process.env.CA_ADMIN_PASSWORD

  return { email, password }
}

type AuthService = {
  register: (
    provider: string,
    input: { body: { email: string; password: string } }
  ) => Promise<{ authIdentity?: { id: string }; error?: string }>
  updateProvider: (
    provider: string,
    data: { entity_id: string; password: string }
  ) => Promise<{ success?: boolean; error?: string; authIdentity?: { id: string } }>
  updateAuthIdentities: (data: {
    id: string
    app_metadata: { user_id: string }
  }) => Promise<unknown>
  authenticate: (
    provider: string,
    input: { body: { email: string; password: string } }
  ) => Promise<{ success?: boolean; error?: string }>
}

async function verifyLogin(
  authService: AuthService,
  email: string,
  password: string
): Promise<boolean> {
  const auth = await authService.authenticate("emailpass", {
    body: { email, password },
  })
  return auth.success === true
}

async function setEmailPassword(
  authService: AuthService,
  email: string,
  password: string,
  userId: string,
  logger: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<boolean> {
  const updated = await authService.updateProvider("emailpass", {
    entity_id: email,
    password,
  })

  logger.info(
    `updateProvider: success=${String(updated.success)} error=${updated.error ?? "none"}`
  )

  if (await verifyLogin(authService, email, password)) {
    logger.info("Login verified.")
    return true
  }

  const { authIdentity, error } = await authService.register("emailpass", {
    body: { email, password },
  })

  if (error?.includes("already exists")) {
    logger.error(
      `Password reset failed for ${email}. Auth identity exists but login still fails — contact support or delete the user in admin and re-run this script.`
    )
    return false
  }

  if (error || !authIdentity?.id) {
    logger.error(error ?? "Failed to set password for CA user")
    return false
  }

  await authService.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { user_id: userId },
  })

  if (await verifyLogin(authService, email, password)) {
    logger.info("Registered auth identity and verified login.")
    return true
  }

  logger.error("Auth identity saved but login verification failed.")
  return false
}

/**
 * Create (or promote) a CA admin user with GST-only access.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/create-ca-admin-user.ts ca@firm.com gst
 */
export default async function createCaAdminUser({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const userService = container.resolve(Modules.USER) as {
    createUsers: (data: {
      email: string
      metadata?: Record<string, unknown>
    }) => Promise<{ id: string; email: string }>
    updateUsers: (data: {
      id: string
      metadata?: Record<string, unknown>
    }) => Promise<{ id: string; email: string }>
  }
  const authService = container.resolve(Modules.AUTH) as AuthService

  const { email, password } = parseEmailPassword()

  logger.info(`Target email: ${email ?? "(missing)"}`)
  if (password) {
    logger.info(`Password length: ${password.length}`)
  }

  if (!email) {
    logger.error(
      "Email required. Usage: npx medusa exec ./src/scripts/create-ca-admin-user.ts ca@firm.com gst"
    )
    return
  }

  if (!password || password.length < 3) {
    logger.error("Password required (min 3 characters).")
    return
  }

  const { data: existingUsers } = await query.graph({
    entity: "user",
    fields: ["id", "email", "metadata"],
    filters: { email },
  })

  const existing = existingUsers?.[0] as
    | { id?: string; email?: string; metadata?: Record<string, unknown> | null }
    | undefined

  if (existing?.id) {
    await userService.updateUsers({
      id: existing.id,
      metadata: {
        ...(existing.metadata ?? {}),
        [ADMIN_ROLE_KEY]: ADMIN_ROLE_CA,
      },
    })

    const ok = await setEmailPassword(
      authService,
      email,
      password,
      existing.id,
      logger
    )

    if (!ok) {
      return
    }

    logger.info(`Updated CA admin user: ${email}`)
    logger.info("Password reset. This login only sees GST Filing in admin.")
    return
  }

  const user = await userService.createUsers({
    email,
    metadata: { [ADMIN_ROLE_KEY]: ADMIN_ROLE_CA },
  })

  const ok = await setEmailPassword(
    authService,
    email,
    password,
    user.id,
    logger
  )

  if (!ok) {
    return
  }

  logger.info(`CA admin user created: ${email}`)
  logger.info("This login only sees GST Filing in admin.")
}
