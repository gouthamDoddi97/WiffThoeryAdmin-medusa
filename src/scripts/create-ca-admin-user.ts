import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  ADMIN_ROLE_CA,
  ADMIN_ROLE_KEY,
} from "../lib/admin/roles"

/**
 * Create (or promote) a CA admin user with GST-only access.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/create-ca-admin-user.ts ca@firm.com "YourPassword"
 *
 * Or with env:
 *   CA_ADMIN_EMAIL=ca@firm.com CA_ADMIN_PASSWORD=... npx medusa exec ./src/scripts/create-ca-admin-user.ts
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
  const authService = container.resolve(Modules.AUTH) as {
    register: (
      provider: string,
      input: { body: { email: string; password: string } }
    ) => Promise<{
      authIdentity?: { id: string }
      error?: Error
    }>
    updateAuthIdentities: (data: {
      id: string
      app_metadata: { user_id: string }
    }) => Promise<unknown>
  }

  const argv = process.argv.slice(2).filter((arg) => !arg.startsWith("-"))
  const email = argv.find((arg) => arg.includes("@")) ?? process.env.CA_ADMIN_EMAIL
  const password =
    argv.find((arg) => !arg.includes("@") && arg.length >= 8) ??
    process.env.CA_ADMIN_PASSWORD

  if (!email) {
    logger.error(
      "Email required. Usage: npx medusa exec ./src/scripts/create-ca-admin-user.ts ca@firm.com \"password\""
    )
    return
  }

  if (!password || password.length < 8) {
    logger.error("Password required (min 8 characters).")
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
    logger.info(`Updated existing user ${email} with CA (GST-only) role.`)
    logger.info("If login fails, reset the password from Settings → Users in admin.")
    return
  }

  const user = await userService.createUsers({
    email,
    metadata: { [ADMIN_ROLE_KEY]: ADMIN_ROLE_CA },
  })

  const { authIdentity, error } = await authService.register("emailpass", {
    body: { email, password },
  })

  if (error || !authIdentity?.id) {
    logger.error(error?.message ?? "Failed to register auth identity for CA user")
    return
  }

  await authService.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { user_id: user.id },
  })

  logger.info(`CA admin user created: ${email}`)
  logger.info("This login only sees GST Filing in admin.")
}
