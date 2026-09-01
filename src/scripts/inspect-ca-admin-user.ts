import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseEmail(): string | undefined {
  const argv = process.argv
  const scriptIdx = argv.findIndex((a) => a.includes("create-ca-admin-user"))
  const positional =
    scriptIdx >= 0
      ? argv.slice(scriptIdx + 1)
      : argv.filter(
          (a) =>
            !a.includes("node_modules") &&
            !a.endsWith(".ts") &&
            a !== "exec" &&
            !a.startsWith("-")
        )

  return (
    positional.find(
      (arg) =>
        EMAIL_RE.test(arg) &&
        !arg.includes("\\") &&
        !arg.includes("/") &&
        !arg.includes("node_modules")
    ) ??
    process.argv.find(
      (arg) =>
        EMAIL_RE.test(arg) &&
        !arg.includes("\\") &&
        !arg.includes("/") &&
        !arg.includes("node_modules")
    ) ??
    process.env.CA_ADMIN_EMAIL
  )
}

/** Debug CA admin auth state. */
export default async function inspectCaAdminUser({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const authService = container.resolve(Modules.AUTH) as {
    authenticate: (
      provider: string,
      input: { body: { email: string; password: string } }
    ) => Promise<{ success?: boolean; error?: string }>
  }

  const email = parseEmail() ?? "ca@whiffthoery.com"
  const password =
    process.env.CA_ADMIN_PASSWORD ??
    process.argv
      .slice(process.argv.indexOf(email) + 1)
      .find((arg) => !arg.includes(".ts") && arg !== "exec") ??
    "gst"

  const { data: users } = await query.graph({
    entity: "user",
    fields: ["id", "email", "metadata"],
    filters: { email },
  })

  const user = users?.[0] as
    | { id?: string; email?: string; metadata?: Record<string, unknown> | null }
    | undefined

  logger.info(`User row for ${email}: ${user?.id ?? "NOT FOUND"}`)
  if (user?.metadata) {
    logger.info(`User metadata: ${JSON.stringify(user.metadata)}`)
  }

  const { data: providerIdentities } = await query.graph({
    entity: "provider_identity",
    fields: ["id", "entity_id", "provider", "auth_identity_id"],
    filters: { entity_id: email },
  })

  logger.info(
    `Provider identities: ${JSON.stringify(providerIdentities ?? [], null, 2)}`
  )

  if (providerIdentities?.[0]?.auth_identity_id) {
    const authId = (providerIdentities[0] as { auth_identity_id: string })
      .auth_identity_id
    const { data: authIdentities } = await query.graph({
      entity: "auth_identity",
      fields: ["id", "app_metadata"],
      filters: { id: authId },
    })
    logger.info(
      `Auth identity: ${JSON.stringify(authIdentities?.[0] ?? null, null, 2)}`
    )
  }

  const auth = await authService.authenticate("emailpass", {
    body: { email, password },
  })
  logger.info(
    `Login test (${email} / ${password}): success=${auth.success} error=${auth.error ?? "none"}`
  )
}
