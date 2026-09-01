import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  caAdminSafeGetResponse,
  isCaAdminPassthroughPath,
  isCaAdminRole,
  resolveAdminRequestPath,
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

  const path = resolveAdminRequestPath(req)
  const rawUrl = req.originalUrl ?? req.url ?? ""
  const method = (req.method ?? "GET").toUpperCase()

  if (isCaAdminPassthroughPath(path, method, rawUrl)) {
    return next()
  }

  try {
    const metadata = await loadUserMetadata(req, actorId)
    if (!isCaAdminRole(metadata)) {
      return next()
    }

    if (method === "GET") {
      res.setHeader("Cache-Control", "no-store")
      res.json(caAdminSafeGetResponse(path, rawUrl))
      return
    }

    res.status(403).json({
      message: "This account only has access to GST Filing.",
      code: "ca_admin_restricted",
    })
  } catch {
    return next()
  }
}
