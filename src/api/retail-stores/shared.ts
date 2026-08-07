import { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow, createStockLocationsWorkflow } from "@medusajs/medusa/core-flows"
import { RETAIL_STORE_MODULE } from "../../modules/retail-store"

export type TransferItem = {
  variant_id: string
  quantity: number
  title?: string
}

type InventoryAdjustment = {
  inventoryItemId: string
  locationId: string
  adjustment: number
}

type InventoryLevelResult = {
  id: string
}

export function toErrorResponse(error: unknown): { status: number; message: string } {
  if (error instanceof MedusaError) {
    const status =
      error.type === MedusaError.Types.NOT_FOUND
        ? 404
        : error.type === MedusaError.Types.NOT_ALLOWED
          ? 409
          : error.type === MedusaError.Types.INVALID_DATA
            ? 400
            : 500

    return { status, message: error.message }
  }

  if (error instanceof Error) {
    return { status: 400, message: error.message }
  }

  return { status: 500, message: "An unexpected error occurred" }
}

export async function listRetailStoreRecords(req: MedusaRequest) {
  const service = req.scope.resolve(RETAIL_STORE_MODULE) as any
  return service.listRetailStores({}, { order: { name: "ASC" } })
}

export async function getRetailStoreRecord(req: MedusaRequest, storeId: string) {
  const service = req.scope.resolve(RETAIL_STORE_MODULE) as any
  const store = await service.retrieveRetailStore(storeId).catch(() => null)

  if (!store) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Retail store ${storeId} was not found`)
  }

  return store
}

export async function getRetailStoreStockLocationIds(req: MedusaRequest): Promise<Set<string>> {
  const stores = await listRetailStoreRecords(req)
  return new Set(stores.map((store: { stock_location_id: string }) => store.stock_location_id))
}

export async function listWarehouseStockLocations(req: MedusaRequest) {
  const query = req.scope.resolve("query") as any
  const retailLocationIds = await getRetailStoreStockLocationIds(req)

  const { data: stock_locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "address.city", "address.country_code"],
  })

  return (stock_locations ?? []).filter(
    (location: { id: string }) => !retailLocationIds.has(location.id)
  )
}

async function emitInventoryLevelUpdatedEvents(
  req: MedusaRequest,
  levels: InventoryLevelResult[]
) {
  if (!levels.length) {
    return
  }

  const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any
  await eventBus.emit(
    levels.map((level) => ({
      name: "inventory.inventory-level.updated",
      data: { id: level.id },
    }))
  )
}

async function applyInventoryAdjustments(
  req: MedusaRequest,
  adjustments: InventoryAdjustment[]
) {
  if (!adjustments.length) {
    return
  }

  const inventoryService = req.scope.resolve(Modules.INVENTORY) as any
  const updatedLevels = await inventoryService.adjustInventory(adjustments)
  const levels = Array.isArray(updatedLevels) ? updatedLevels : [updatedLevels]
  await emitInventoryLevelUpdatedEvents(req, levels)
}

async function getInventoryAdjustments(
  req: MedusaRequest,
  items: TransferItem[],
  stockLocationId: string,
  mode: "deduct" | "restore"
): Promise<InventoryAdjustment[]> {
  const query = req.scope.resolve("query") as any
  const adjustments = new Map<string, InventoryAdjustment>()

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "manage_inventory",
      "inventory_items.inventory_item_id",
      "inventory_items.required_quantity",
      "inventory_items.inventory.location_levels.location_id",
      "inventory_items.inventory.location_levels.stocked_quantity",
      "inventory_items.inventory.location_levels.reserved_quantity",
    ],
    filters: {
      id: {
        $in: items.map((item) => item.variant_id),
      },
    },
  })

  for (const item of items) {
    const variant = variants.find((candidate: any) => candidate.id === item.variant_id)

    if (!variant) {
      throw new Error(`Variant ${item.variant_id} was not found`)
    }

    if (!variant.manage_inventory) {
      continue
    }

    if (!variant.inventory_items?.length) {
      throw new Error(`Variant ${item.variant_id} does not have inventory configured`)
    }

    for (const inventoryItem of variant.inventory_items) {
      const level = inventoryItem.inventory?.location_levels?.find(
        (candidate: any) => candidate.location_id === stockLocationId
      )

      if (!level) {
        throw new Error(
          `Inventory item ${inventoryItem.inventory_item_id} is not stocked at location ${stockLocationId}`
        )
      }

      const requiredQuantity = inventoryItem.required_quantity || 1
      const quantityChange = item.quantity * requiredQuantity

      if (!Number.isFinite(quantityChange) || quantityChange <= 0) {
        throw new Error(
          `Invalid inventory quantity for "${item.title ?? variant.title ?? item.variant_id}" (${item.quantity})`
        )
      }

      if (mode === "deduct") {
        const stocked = Number(level.stocked_quantity ?? 0)
        const reserved = Number(level.reserved_quantity ?? 0)
        const available = stocked - reserved

        if (quantityChange > available) {
          throw new Error(
            `Insufficient stock for "${item.title ?? variant.title ?? item.variant_id}" at the selected warehouse (${available} available, ${quantityChange} requested)`
          )
        }
      }

      const adjustment = mode === "deduct" ? -quantityChange : quantityChange
      const key = `${inventoryItem.inventory_item_id}:${stockLocationId}`
      const existing = adjustments.get(key)

      if (existing) {
        existing.adjustment += adjustment
      } else {
        adjustments.set(key, {
          inventoryItemId: inventoryItem.inventory_item_id,
          locationId: stockLocationId,
          adjustment,
        })
      }
    }
  }

  return Array.from(adjustments.values()).filter((entry) => entry.adjustment !== 0)
}

async function ensureInventoryLevelsAtLocation(
  req: MedusaRequest,
  items: TransferItem[],
  stockLocationId: string
) {
  const query = req.scope.resolve("query") as any
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.location_levels.location_id",
    ],
    filters: {
      id: {
        $in: items.map((item) => item.variant_id),
      },
    },
  })

  const missingLevels: Array<{ inventory_item_id: string; location_id: string }> = []

  for (const item of items) {
    const variant = variants.find((candidate: any) => candidate.id === item.variant_id)
    if (!variant?.inventory_items?.length) {
      continue
    }

    for (const inventoryItem of variant.inventory_items) {
      const hasLevel = inventoryItem.inventory?.location_levels?.some(
        (level: any) => level.location_id === stockLocationId
      )

      if (!hasLevel) {
        missingLevels.push({
          inventory_item_id: inventoryItem.inventory_item_id,
          location_id: stockLocationId,
        })
      }
    }
  }

  if (!missingLevels.length) {
    return
  }

  await createInventoryLevelsWorkflow(req.scope).run({
    input: {
      inventory_levels: missingLevels.map((level) => ({
        inventory_item_id: level.inventory_item_id,
        location_id: level.location_id,
        stocked_quantity: 0,
      })),
    },
  })
}

export async function getStoreInventory(req: MedusaRequest, storeId: string) {
  const store = await getRetailStoreRecord(req, storeId)
  const query = req.scope.resolve("query") as any

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "sku",
      "product_id",
      "product.title",
      "manage_inventory",
      "inventory_items.inventory_item_id",
      "inventory_items.required_quantity",
      "inventory_items.inventory.location_levels.location_id",
      "inventory_items.inventory.location_levels.stocked_quantity",
      "inventory_items.inventory.location_levels.reserved_quantity",
    ],
  })

  const items: Array<{
    variant_id: string
    sku: string | null
    product_id: string | null
    product_title: string | null
    variant_title: string | null
    quantity: number
    available: number
  }> = []

  for (const variant of variants ?? []) {
    if (!variant.manage_inventory || !variant.inventory_items?.length) {
      continue
    }

    let stocked = 0
    let reserved = 0

    for (const inventoryItem of variant.inventory_items) {
      const level = inventoryItem.inventory?.location_levels?.find(
        (candidate: any) => candidate.location_id === store.stock_location_id
      )

      if (!level) {
        continue
      }

      const requiredQuantity = inventoryItem.required_quantity || 1
      stocked += Number(level.stocked_quantity ?? 0) / requiredQuantity
      reserved += Number(level.reserved_quantity ?? 0) / requiredQuantity
    }

    const quantity = Math.floor(stocked)
    const available = Math.max(0, Math.floor(stocked - reserved))

    if (quantity <= 0 && available <= 0) {
      continue
    }

    items.push({
      variant_id: variant.id,
      sku: variant.sku ?? null,
      product_id: variant.product_id ?? null,
      product_title: variant.product?.title ?? null,
      variant_title: variant.title ?? null,
      quantity,
      available,
    })
  }

  items.sort((a, b) =>
    `${a.product_title ?? ""} ${a.variant_title ?? ""}`.localeCompare(
      `${b.product_title ?? ""} ${b.variant_title ?? ""}`
    )
  )

  return { store, items }
}

export async function createRetailStore(
  req: MedusaRequest,
  body: { name: string; location: string; notes?: string; is_active?: boolean }
) {
  const name = body.name?.trim()
  const location = body.location?.trim()

  if (!name) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Store name is required")
  }

  if (!location) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Store location is required")
  }

  const { result } = await createStockLocationsWorkflow(req.scope).run({
    input: {
      locations: [
        {
          name: `Retail: ${name}`,
          address: {
            address_1: location.slice(0, 120),
            city: location.slice(0, 80),
            country_code: "in",
          },
          metadata: {
            retail_store: true,
          },
        },
      ],
    },
  })

  const stockLocation = result[0]
  const service = req.scope.resolve(RETAIL_STORE_MODULE) as any

  const store = await service.createRetailStores({
    name,
    location,
    stock_location_id: stockLocation.id,
    notes: body.notes?.trim() || null,
    is_active: body.is_active ?? true,
  })

  return { store, stock_location: stockLocation }
}

export async function updateRetailStore(
  req: MedusaRequest,
  storeId: string,
  body: { name?: string; location?: string; notes?: string | null; is_active?: boolean }
) {
  const store = await getRetailStoreRecord(req, storeId)
  const stockLocationModule = req.scope.resolve(Modules.STOCK_LOCATION) as any
  const service = req.scope.resolve(RETAIL_STORE_MODULE) as any

  const update: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Store name is required")
    }
    update.name = name
  }

  if (body.location !== undefined) {
    const location = body.location.trim()
    if (!location) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Store location is required")
    }
    update.location = location
  }

  if (body.notes !== undefined) {
    update.notes = body.notes?.trim() || null
  }

  if (body.is_active !== undefined) {
    update.is_active = body.is_active
  }

  const updated = Object.keys(update).length
    ? await service.updateRetailStores({ id: storeId, ...update })
    : store

  if (body.name !== undefined || body.location !== undefined) {
    await stockLocationModule.updateStockLocations(store.stock_location_id, {
      name: `Retail: ${updated.name ?? store.name}`,
      address: {
        address_1: (updated.location ?? store.location).slice(0, 120),
        city: (updated.location ?? store.location).slice(0, 80),
        country_code: "in",
      },
    })
  }

  return updated
}

export async function deleteRetailStore(req: MedusaRequest, storeId: string) {
  const store = await getRetailStoreRecord(req, storeId)
  const service = req.scope.resolve(RETAIL_STORE_MODULE) as any
  await service.deleteRetailStores(storeId)
  return { id: storeId, stock_location_id: store.stock_location_id }
}

export async function transferStockToStore(
  req: MedusaRequest,
  storeId: string,
  body: {
    from_stock_location_id: string
    items: TransferItem[]
    notes?: string
  }
) {
  const store = await getRetailStoreRecord(req, storeId)
  const fromLocationId = body.from_stock_location_id?.trim()
  const items = body.items ?? []

  if (!fromLocationId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Select a warehouse to transfer from")
  }

  if (fromLocationId === store.stock_location_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Source warehouse must be different from the store shelf location"
    )
  }

  if (!items.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Add at least one SKU to transfer")
  }

  const retailLocationIds = await getRetailStoreStockLocationIds(req)
  if (retailLocationIds.has(fromLocationId)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Transfers must come from a warehouse, not another retail store"
    )
  }

  await ensureInventoryLevelsAtLocation(req, items, store.stock_location_id)

  const deductAdjustments = await getInventoryAdjustments(req, items, fromLocationId, "deduct")
  const addAdjustments = await getInventoryAdjustments(
    req,
    items,
    store.stock_location_id,
    "restore"
  )

  await applyInventoryAdjustments(req, [...deductAdjustments, ...addAdjustments])

  const service = req.scope.resolve(RETAIL_STORE_MODULE) as any
  const transfers = await service.createStoreStockTransfers(
    items.map((item) => ({
      retail_store_id: storeId,
      from_stock_location_id: fromLocationId,
      variant_id: item.variant_id,
      quantity: item.quantity,
      notes: body.notes?.trim() || null,
    }))
  )

  const inventory = await getStoreInventory(req, storeId)

  return {
    store: inventory.store,
    items: inventory.items,
    transfers,
  }
}

export async function resolveRetailStoreForOfflineSale(
  req: MedusaRequest,
  retailStoreId?: string
) {
  if (!retailStoreId?.trim()) {
    return null
  }

  const store = await getRetailStoreRecord(req, retailStoreId.trim())

  if (!store.is_active) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Selected retail store is inactive")
  }

  return store
}
