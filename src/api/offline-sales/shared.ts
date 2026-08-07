import { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { calculateOrderChange } from "@medusajs/order/dist/utils/calculate-order-change"
import { createOrderWorkflow } from "@medusajs/medusa/core-flows"
import { decorateCartTotals } from "@medusajs/utils"
import { BUDGET_FINANCE_MODULE } from "../../modules/budget-finance"
import {
  listRetailStoreRecords,
  listWarehouseStockLocations,
  resolveRetailStoreForOfflineSale,
} from "../retail-stores/shared"

export type OfflineSaleItem = {
  product_id?: string
  product_title?: string
  title: string
  variant_id: string
  variant_title?: string
  quantity: number
  unit_price: number
}

export type OfflineSaleBody = {
  email?: string
  customer_name: string
  customer_phone?: string
  seller_name: string
  payment_method: string
  region_id: string
  currency_code: string
  stock_location_id: string
  retail_store_id?: string
  items: OfflineSaleItem[]
  original_total: number
  paid_amount: number
  discount_applied: number
}

type InventoryAdjustment = {
  inventoryItemId: string
  locationId: string
  adjustment: number
}

type InventoryLevelResult = {
  id: string
}

type InventoryMode = "deduct" | "restore"

const OFFLINE_DISCOUNT_CODE = "offline-discount"
const OFFLINE_DISCOUNT_PROVIDER = "offline_sale"

const OFFLINE_SALE_ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "status",
  "created_at",
  "updated_at",
  "canceled_at",
  "metadata",
  "region_id",
  "version",
  "total",
  "items.id",
  "items.title",
  "items.quantity",
  "items.unit_price",
  "items.detail.quantity",
  "items.detail.unit_price",
  "items.variant_id",
  "items.product_id",
  "items.variant_title",
  "items.product_title",
  "items.metadata",
  "items.adjustments.id",
  "items.adjustments.code",
  "items.adjustments.provider_id",
  "transactions.id",
  "transactions.amount",
  "transactions.reference",
  "transactions.currency_code",
]

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

function validateOfflineSaleBody(body: OfflineSaleBody) {
  if (!body.customer_name?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Customer name is required"
    )
  }
  if (!body.seller_name?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Seller name is required"
    )
  }
}

function isOfflineSale(order: { metadata?: Record<string, unknown> | null }) {
  return order.metadata?.offline_sale === true
}

function parseOrderNumeric(value: unknown): number {
  if (value == null || value === "") {
    return NaN
  }
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string") {
    return Number(value)
  }
  if (typeof value === "object" && "value" in (value as object)) {
    return Number((value as { value: unknown }).value)
  }
  return Number(value)
}

function resolveOrderItemQuantity(item: any): number {
  return parseOrderNumeric(
    item.detail?.quantity ?? item.quantity ?? item.detail?.raw_quantity?.value
  )
}

function resolveOrderItemUnitPrice(item: any): number {
  return parseOrderNumeric(
    item.detail?.unit_price ??
      item.unit_price ??
      item.detail?.raw_unit_price?.value
  )
}

function normalizeOfflineSaleItem(item: any) {
  return {
    ...item,
    quantity: resolveOrderItemQuantity(item),
    unit_price: resolveOrderItemUnitPrice(item),
  }
}

function normalizeOfflineSaleOrder(order: any) {
  return {
    ...order,
    items: (order.items ?? []).map(normalizeOfflineSaleItem),
  }
}

function resolveOrderStockLocationId(order: {
  metadata?: Record<string, unknown> | null
  items?: Array<{ metadata?: Record<string, unknown> | null }>
}) {
  const fromOrder = order.metadata?.stock_location_id
  if (fromOrder) {
    return String(fromOrder).trim()
  }

  for (const item of order.items ?? []) {
    const fromLine = item.metadata?.stock_location_id
    if (fromLine) {
      return String(fromLine).trim()
    }
  }

  return ""
}

function orderItemsToSaleItems(order: any): OfflineSaleItem[] {
  return (order.items ?? [])
    .filter((item: any) => item.variant_id)
    .map((item: any) => {
      const quantity = resolveOrderItemQuantity(item)
      const unit_price = resolveOrderItemUnitPrice(item)

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(
          `Invalid quantity for "${item.title ?? item.variant_id}" — cannot restore inventory`
        )
      }

      return {
        title: item.title,
        variant_id: item.variant_id,
        quantity,
        unit_price: Number.isFinite(unit_price) ? unit_price : 0,
        product_id: item.product_id ?? undefined,
        product_title: item.product_title ?? undefined,
        variant_title: item.variant_title ?? undefined,
      }
    })
}

async function getFounderNames(req: MedusaRequest): Promise<string[]> {
  try {
    const service = req.scope.resolve(BUDGET_FINANCE_MODULE) as any
    const [settings] = await service.listBudgetSettings({}, { take: 1 })
    if (!settings) {
      return ["Founder 1", "Founder 2", "Founder 3"]
    }
    return [
      settings.founder_1_name,
      settings.founder_2_name,
      settings.founder_3_name,
    ].filter(Boolean)
  } catch {
    return ["Founder 1", "Founder 2", "Founder 3"]
  }
}

function collectCustomSellerNames(
  sales: Array<{ metadata?: Record<string, unknown> | null }>,
  founderNames: string[]
) {
  const founderSet = new Set(founderNames.map((name) => name.toLowerCase()))
  const names = new Set<string>()

  for (const sale of sales) {
    const name = String(sale.metadata?.seller_name ?? "").trim()
    if (name && !founderSet.has(name.toLowerCase())) {
      names.add(name)
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b))
}

async function cancelOfflineSaleOrder(req: MedusaRequest, orderId: string) {
  const orderService = req.scope.resolve(Modules.ORDER) as any
  const inventoryService = req.scope.resolve(Modules.INVENTORY) as any
  const order = await getOfflineSale(req, orderId)

  const lineItemIds = (order.items ?? [])
    .map((item: { id?: string }) => item.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  if (lineItemIds.length) {
    await inventoryService.deleteReservationItemsByLineItem(lineItemIds)
  }

  const transactions = await orderService.listOrderTransactions({ order_id: orderId })
  for (const transaction of transactions ?? []) {
    await orderService.deleteOrderTransactions(transaction.id)
  }

  await orderService.cancel(orderId)
}

export async function listOfflineSaleSetup(
  req: MedusaRequest,
  sales: Array<{ metadata?: Record<string, unknown> | null }> = []
) {
  const query = req.scope.resolve("query") as any

  const [regionsResult, founder_names, retail_stores, stock_locations] =
    await Promise.all([
      query.graph({
        entity: "region",
        fields: ["id", "name", "currency_code"],
      }),
      getFounderNames(req),
      listRetailStoreRecords(req),
      listWarehouseStockLocations(req),
    ])

  return {
    stock_locations: stock_locations ?? [],
    retail_stores: (retail_stores ?? []).filter((store: { is_active?: boolean }) => store.is_active !== false),
    regions: regionsResult?.data ?? [],
    founder_names,
    custom_seller_names: collectCustomSellerNames(sales, founder_names),
  }
}

export async function listOfflineSales(req: MedusaRequest) {
  const query = req.scope.resolve("query") as any
  const { data: orders } = await query.graph({
    entity: "order",
    fields: OFFLINE_SALE_ORDER_FIELDS,
    pagination: {
      take: 100,
      skip: 0,
      order: { created_at: "DESC" },
    },
  })

  return (orders ?? []).filter(isOfflineSale).map(normalizeOfflineSaleOrder)
}

export async function getOfflineSale(req: MedusaRequest, orderId: string) {
  const query = req.scope.resolve("query") as any
  const { data: orders } = await query.graph({
    entity: "order",
    fields: OFFLINE_SALE_ORDER_FIELDS,
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order || !isOfflineSale(order)) {
    throw new Error(`Offline sale ${orderId} was not found`)
  }

  return normalizeOfflineSaleOrder(order)
}

async function validateStockLocation(req: MedusaRequest, stockLocationId: string) {
  const query = req.scope.resolve("query") as any
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { id: stockLocationId },
  })

  if (!locations?.length) {
    throw new Error(`Stock location ${stockLocationId} was not found`)
  }

  return locations[0]
}

async function getInventoryAdjustments(
  req: MedusaRequest,
  items: OfflineSaleItem[],
  stockLocationId: string,
  mode: InventoryMode = "deduct"
): Promise<InventoryAdjustment[]> {
  const query = req.scope.resolve("query") as any
  const adjustments = new Map<string, InventoryAdjustment>()

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
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

    if (!variant?.manage_inventory) {
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
          `Invalid inventory quantity for "${item.title}" (${item.quantity})`
        )
      }

      if (mode === "deduct") {
        const stocked = Number(level.stocked_quantity ?? 0)
        const reserved = Number(level.reserved_quantity ?? 0)
        const available = stocked - reserved

        if (quantityChange > available) {
          throw new Error(
            `Insufficient stock for "${item.title}" at the selected warehouse (${available} available, ${quantityChange} requested)`
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

async function getInventoryReconciliationAdjustments(
  req: MedusaRequest,
  oldItems: OfflineSaleItem[],
  newItems: OfflineSaleItem[],
  stockLocationId: string
): Promise<InventoryAdjustment[]> {
  const oldMap = new Map<string, number>()
  const newMap = new Map<string, number>()

  for (const item of oldItems) {
    oldMap.set(item.variant_id, (oldMap.get(item.variant_id) ?? 0) + item.quantity)
  }

  for (const item of newItems) {
    newMap.set(item.variant_id, (newMap.get(item.variant_id) ?? 0) + item.quantity)
  }

  const deductItems: OfflineSaleItem[] = []
  const restoreItems: OfflineSaleItem[] = []

  for (const variantId of new Set([...oldMap.keys(), ...newMap.keys()])) {
    const oldQty = oldMap.get(variantId) ?? 0
    const newQty = newMap.get(variantId) ?? 0
    const delta = newQty - oldQty

    if (delta === 0) {
      continue
    }

    const source =
      newItems.find((item) => item.variant_id === variantId) ??
      oldItems.find((item) => item.variant_id === variantId)

    if (!source) {
      continue
    }

    if (delta > 0) {
      deductItems.push({ ...source, quantity: delta })
    } else {
      restoreItems.push({ ...source, quantity: Math.abs(delta) })
    }
  }

  const deductAdjustments = deductItems.length
    ? await getInventoryAdjustments(req, deductItems, stockLocationId, "deduct")
    : []
  const restoreAdjustments = restoreItems.length
    ? await getInventoryAdjustments(req, restoreItems, stockLocationId, "restore")
    : []

  const merged = new Map<string, InventoryAdjustment>()

  for (const entry of [...deductAdjustments, ...restoreAdjustments]) {
    const key = `${entry.inventoryItemId}:${entry.locationId}`
    const existing = merged.get(key)

    if (existing) {
      existing.adjustment += entry.adjustment
    } else {
      merged.set(key, { ...entry })
    }
  }

  return Array.from(merged.values()).filter((entry) => entry.adjustment !== 0)
}

function mergeInventoryAdjustments(
  ...groups: InventoryAdjustment[][]
): InventoryAdjustment[] {
  const merged = new Map<string, InventoryAdjustment>()

  for (const group of groups) {
    for (const entry of group) {
      const key = `${entry.inventoryItemId}:${entry.locationId}`
      const existing = merged.get(key)

      if (existing) {
        existing.adjustment += entry.adjustment
      } else {
        merged.set(key, { ...entry })
      }
    }
  }

  return Array.from(merged.values()).filter((entry) => entry.adjustment !== 0)
}

async function getOfflineSaleUpdateInventoryAdjustments(
  req: MedusaRequest,
  oldItems: OfflineSaleItem[],
  newItems: OfflineSaleItem[],
  oldLocationId: string,
  newLocationId: string
): Promise<InventoryAdjustment[]> {
  if (!oldLocationId) {
    return getInventoryReconciliationAdjustments(
      req,
      oldItems,
      newItems,
      newLocationId
    )
  }

  if (oldLocationId === newLocationId) {
    return getInventoryReconciliationAdjustments(req, oldItems, newItems, oldLocationId)
  }

  const restoreAtOld = oldItems.length
    ? await getInventoryAdjustments(req, oldItems, oldLocationId, "restore")
    : []
  const deductAtNew = newItems.length
    ? await getInventoryAdjustments(req, newItems, newLocationId, "deduct")
    : []

  return mergeInventoryAdjustments(restoreAtOld, deductAtNew)
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

function allocateDiscountToItems(items: OfflineSaleItem[], discountApplied: number) {
  const allocations = new Map<string, number>()

  if (!discountApplied || discountApplied <= 0 || !items.length) {
    return allocations
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  )

  if (subtotal <= 0) {
    return allocations
  }

  let remaining = discountApplied

  items.forEach((item, index) => {
    const lineTotal = item.quantity * item.unit_price
    let share =
      index === items.length - 1
        ? remaining
        : Math.round((discountApplied * lineTotal) / subtotal)

    share = Math.min(Math.max(share, 0), lineTotal, remaining)

    if (share > 0) {
      allocations.set(item.variant_id, (allocations.get(item.variant_id) ?? 0) + share)
      remaining -= share
    }
  })

  return allocations
}

function buildDiscountAdjustments(discountAmount: number) {
  if (!discountAmount || discountAmount <= 0) {
    return undefined
  }

  return [
    {
      code: OFFLINE_DISCOUNT_CODE,
      description: "Offline sale discount",
      amount: discountAmount,
      provider_id: OFFLINE_DISCOUNT_PROVIDER,
    },
  ]
}

function buildOrderLineItemsForCreate(
  items: OfflineSaleItem[],
  stockLocationId: string,
  discountApplied: number,
  retailStore?: { id: string; name: string; location: string } | null
) {
  const discountByVariant = allocateDiscountToItems(items, discountApplied)

  return items.map((item) => ({
    title: item.title,
    product_id: item.product_id,
    product_title: item.product_title,
    variant_id: item.variant_id,
    variant_title: item.variant_title,
    quantity: item.quantity,
    unit_price: item.unit_price,
    metadata: {
      offline_sale: true,
      stock_location_id: stockLocationId,
      ...(retailStore
        ? {
            retail_store_id: retailStore.id,
            store_name: retailStore.name,
            store_location: retailStore.location,
          }
        : {}),
    },
    adjustments: buildDiscountAdjustments(discountByVariant.get(item.variant_id) ?? 0),
  }))
}

async function syncOfflineSaleDiscountAdjustments(
  req: MedusaRequest,
  orderId: string,
  items: OfflineSaleItem[],
  discountApplied: number
) {
  const orderService = req.scope.resolve(Modules.ORDER) as any
  const order = await getOfflineSale(req, orderId)
  const discountByVariant = allocateDiscountToItems(items, discountApplied)

  const adjustmentIdsToDelete: string[] = []
  for (const item of order.items ?? []) {
    for (const adjustment of item.adjustments ?? []) {
      if (
        adjustment.code === OFFLINE_DISCOUNT_CODE ||
        adjustment.provider_id === OFFLINE_DISCOUNT_PROVIDER
      ) {
        adjustmentIdsToDelete.push(adjustment.id)
      }
    }
  }

  if (adjustmentIdsToDelete.length) {
    await orderService.deleteOrderLineItemAdjustments(adjustmentIdsToDelete)
  }

  const adjustmentsToCreate: Array<{
    item_id: string
    code: string
    description: string
    amount: number
    provider_id: string
  }> = []

  for (const item of order.items ?? []) {
    if (!item.variant_id) {
      continue
    }

    const amount = discountByVariant.get(item.variant_id) ?? 0
    if (amount > 0) {
      adjustmentsToCreate.push({
        item_id: item.id,
        code: OFFLINE_DISCOUNT_CODE,
        description: "Offline sale discount",
        amount,
        provider_id: OFFLINE_DISCOUNT_PROVIDER,
      })
    }
  }

  if (adjustmentsToCreate.length) {
    await orderService.createOrderLineItemAdjustments(orderId, adjustmentsToCreate)
  }
}

async function syncOfflineSalePayment(
  req: MedusaRequest,
  orderId: string,
  paidAmount: number,
  currencyCode: string,
  paymentMethod: string
) {
  const orderService = req.scope.resolve(Modules.ORDER) as any
  const transactions = await orderService.listOrderTransactions({ order_id: orderId })

  for (const transaction of transactions ?? []) {
    if (transaction.reference === "offline_sale") {
      await orderService.deleteOrderTransactions(transaction.id)
    }
  }

  if (paidAmount > 0) {
    await orderService.createOrderTransactions({
      order_id: orderId,
      amount: paidAmount,
      currency_code: currencyCode,
      reference: "offline_sale",
      reference_id: `${paymentMethod}:${Date.now()}`,
    })
  }
}

async function refreshOfflineSaleOrderSummary(req: MedusaRequest, orderId: string) {
  const query = req.scope.resolve("query") as any
  const orderService = req.scope.resolve(Modules.ORDER) as any

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "version",
      "currency_code",
      "items.*",
      "items.adjustments.*",
      "items.tax_lines.*",
      "transactions.*",
      "summary.id",
      "summary.totals",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    return
  }

  const items = (order.items ?? []).map((item: any) => ({
    ...item,
    detail: item.detail ?? { quantity: item.quantity },
  }))

  const orderWithTotals = decorateCartTotals({
    ...order,
    items,
  }) as any

  const calculated = calculateOrderChange({
    order: orderWithTotals,
    transactions: order.transactions ?? [],
  })

  const summaryTotals = calculated.getSummaryFromOrder(orderWithTotals)
  const summaries = await orderService.listOrderSummaries({
    order_id: orderId,
    version: order.version,
  })

  const summary = summaries?.[0]
  if (!summary?.id) {
    return
  }

  await orderService.orderSummaryService_.update([
    { id: summary.id, totals: summaryTotals },
  ])
}

export async function processOfflineSale(req: MedusaRequest, body: OfflineSaleBody) {
  validateOfflineSaleBody(body)

  const {
    email,
    customer_name,
    customer_phone,
    seller_name,
    payment_method,
    region_id,
    currency_code,
    stock_location_id,
    retail_store_id,
    items,
    original_total,
    paid_amount,
    discount_applied,
  } = body

  if (!region_id || !currency_code) {
    throw new Error("Missing region or currency for offline sale")
  }

  const retailStore = await resolveRetailStoreForOfflineSale(req, retail_store_id)
  const resolvedStockLocationId = retailStore?.stock_location_id ?? stock_location_id?.trim()

  if (!resolvedStockLocationId) {
    throw new Error("Missing stock_location_id for offline sale")
  }

  if (!items?.length) {
    throw new Error("Offline sale must include at least one item")
  }

  await validateStockLocation(req, resolvedStockLocationId)
  const inventoryAdjustments = await getInventoryAdjustments(
    req,
    items,
    resolvedStockLocationId,
    "deduct"
  )

  const customerEmail = email?.trim() || undefined
  const customerPhone = customer_phone?.trim() || undefined
  const customerName = customer_name.trim()

  const { result: order } = await createOrderWorkflow(req.scope).run({
    input: {
      ...(customerEmail ? { email: customerEmail } : {}),
      region_id,
      currency_code,
      status: "completed",
      no_notification: true,
      items: buildOrderLineItemsForCreate(
        items,
        resolvedStockLocationId,
        discount_applied,
        retailStore
      ),
      transactions: [
        {
          amount: paid_amount,
          currency_code,
          reference: "offline_sale",
          reference_id: `${payment_method}:${Date.now()}`,
        },
      ],
      metadata: {
        offline_sale: true,
        customer_name: customerName,
        seller_name,
        payment_method,
        stock_location_id: resolvedStockLocationId,
        original_total,
        paid_amount,
        discount_applied,
        ...(customerPhone ? { customer_phone: customerPhone } : {}),
        ...(retailStore
          ? {
              retail_store_id: retailStore.id,
              store_name: retailStore.name,
              store_location: retailStore.location,
            }
          : {}),
      },
    },
  })

  await applyInventoryAdjustments(req, inventoryAdjustments)
  await refreshOfflineSaleOrderSummary(req, order.id)

  return { order }
}

export async function updateOfflineSale(
  req: MedusaRequest,
  orderId: string,
  body: OfflineSaleBody
) {
  validateOfflineSaleBody(body)

  const order = await getOfflineSale(req, orderId)

  if (order.canceled_at) {
    throw new Error("Cannot edit a canceled offline sale")
  }

  const oldLocationId = resolveOrderStockLocationId(order)
  const retailStore = await resolveRetailStoreForOfflineSale(req, body.retail_store_id)
  const newLocationId =
    (retailStore?.stock_location_id ?? body.stock_location_id?.trim()) || oldLocationId

  if (!newLocationId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      retailStore ? "Retail store is missing a shelf location" : "Select a warehouse to save this sale"
    )
  }

  await validateStockLocation(req, newLocationId)

  if (!body.items?.length) {
    throw new Error("Offline sale must include at least one item")
  }

  const oldItems = orderItemsToSaleItems(order)
  const inventoryAdjustments = await getOfflineSaleUpdateInventoryAdjustments(
    req,
    oldItems,
    body.items,
    oldLocationId,
    newLocationId
  )

  const orderService = req.scope.resolve(Modules.ORDER) as any
  const customerEmail = body.email?.trim() || undefined
  const customerPhone = body.customer_phone?.trim() || undefined

  if (customerEmail !== (order.email ?? undefined)) {
    await orderService.updateOrders(orderId, {
      email: customerEmail ?? null,
    })
  }

  await orderService.updateOrders(orderId, {
    metadata: {
      ...order.metadata,
      offline_sale: true,
      customer_name: body.customer_name.trim(),
      seller_name: body.seller_name,
      payment_method: body.payment_method,
      stock_location_id: newLocationId,
      original_total: body.original_total,
      paid_amount: body.paid_amount,
      discount_applied: body.discount_applied,
      customer_phone: customerPhone ?? null,
      ...(retailStore
        ? {
            retail_store_id: retailStore.id,
            store_name: retailStore.name,
            store_location: retailStore.location,
          }
        : {
            retail_store_id: null,
            store_name: null,
            store_location: null,
          }),
    },
  })

  const existingByVariant = new Map<string, any>()
  for (const item of order.items ?? []) {
    if (item.variant_id) {
      existingByVariant.set(item.variant_id, item)
    }
  }

  const newVariantIds = new Set(body.items.map((item) => item.variant_id))

  for (const item of body.items) {
    const existing = existingByVariant.get(item.variant_id)

    if (existing) {
      await orderService.updateOrderLineItems(existing.id, {
        quantity: item.quantity,
        unit_price: item.unit_price,
        title: item.title,
        product_id: item.product_id,
        product_title: item.product_title,
        variant_title: item.variant_title,
        metadata: {
          ...(existing.metadata ?? {}),
          offline_sale: true,
          stock_location_id: newLocationId,
          ...(retailStore
            ? {
                retail_store_id: retailStore.id,
                store_name: retailStore.name,
                store_location: retailStore.location,
              }
            : {
                retail_store_id: null,
                store_name: null,
                store_location: null,
              }),
        },
      })
      continue
    }

    await orderService.createOrderLineItems(orderId, [
      {
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        variant_id: item.variant_id,
        product_id: item.product_id,
        product_title: item.product_title,
        variant_title: item.variant_title,
        metadata: {
          offline_sale: true,
          stock_location_id: newLocationId,
          ...(retailStore
            ? {
                retail_store_id: retailStore.id,
                store_name: retailStore.name,
                store_location: retailStore.location,
              }
            : {}),
        },
      },
    ])
  }

  for (const [variantId, existing] of existingByVariant) {
    if (!newVariantIds.has(variantId)) {
      await orderService.deleteOrderLineItems(existing.id)
    }
  }

  await applyInventoryAdjustments(req, inventoryAdjustments)
  await syncOfflineSaleDiscountAdjustments(
    req,
    orderId,
    body.items,
    body.discount_applied
  )
  await syncOfflineSalePayment(
    req,
    orderId,
    body.paid_amount,
    body.currency_code,
    body.payment_method
  )
  await refreshOfflineSaleOrderSummary(req, orderId)

  const updated = await getOfflineSale(req, orderId)
  return { order: updated }
}

export async function deleteOfflineSale(req: MedusaRequest, orderId: string) {
  const order = await getOfflineSale(req, orderId)

  if (order.canceled_at) {
    throw new Error("Offline sale is already canceled")
  }

  const stockLocationId = resolveOrderStockLocationId(order)
  const restoreItems = orderItemsToSaleItems(order)

  if (stockLocationId && restoreItems.length) {
    const inventoryAdjustments = await getInventoryAdjustments(
      req,
      restoreItems,
      stockLocationId,
      "restore"
    )
    await applyInventoryAdjustments(req, inventoryAdjustments)
  }

  await cancelOfflineSaleOrder(req, orderId)

  return { order_id: orderId, canceled: true }
}
