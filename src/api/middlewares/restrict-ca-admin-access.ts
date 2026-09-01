import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  isCaAdminApiPathAllowed,
  isCaAdminRole,
} from "../../lib/admin/roles"

async function loadUserMetadata(
  req: MedusaRequest,
  userId: string
): Promise<Record<string, unknown> | null | undefined> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "user",
    fields: ["metadata"],
    filters: { id: userId },
  })

  const user = data?.[0] as { metadata?: Record<string, unknown> | null } | undefined
  return user?.metadata
}

export async function restrictCaAdminAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const authReq = req as AuthenticatedMedusaRequest
  const actorId = authReq.auth_context?.actor_id
  const actorType = authReq.auth_context?.actor_type

  if (!actorId || actorType !== "user") {
    return next()
  }

  const path = req.path ?? req.url?.split("?")[0] ?? ""
  const method = req.method ?? "GET"

  if (isCaAdminApiPathAllowed(path, method)) {
    return next()
  }

  try {
    const metadata = await loadUserMetadata(req, actorId)
    if (!isCaAdminRole(metadata)) {
      return next()
    }

    res.status(403).json({
      message: "This account is limited to GST filing.",
      code: "ca_admin_restricted",
    })
  } catch {
    return next()
  }
}
