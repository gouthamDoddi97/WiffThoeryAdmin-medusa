import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import type { GstFilingFilters } from "../../../../lib/gst-filing/build-gstr1-json"
import {
  loadGstSaleRecords,
  updateGstRecordInclusion,
} from "../../../../lib/gst-filing/gst-records"

function parseYearMonth(req: MedusaRequest): { year: number; month: number } | null {
  const year = Number(req.query.year)
  const month = Number(req.query.month)

  if (
    !Number.isInteger(year) ||
    year < 2017 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null
  }

  return { year, month }
}

function parseBool(value: unknown): boolean {
  return value === "true" || value === "1"
}

function parseFilters(req: MedusaRequest): GstFilingFilters {
  return {
    ignoreSales: parseBool(req.query.ignore_sales),
    ignoreOnlineSales: parseBool(req.query.ignore_online_sales),
    ignoreOfflineSales: parseBool(req.query.ignore_offline_sales),
  }
}

/** GET /admin/gst-filing/records — sales table for Manage GST Records */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const period = parseYearMonth(req)
  if (!period) {
    res.status(400).json({
      message: "Query params year (YYYY) and month (1–12) are required",
    })
    return
  }

  try {
    const data = await loadGstSaleRecords(req.scope, {
      year: period.year,
      month: period.month,
      filters: parseFilters(req),
    })
    res.json(data)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load GST records"
    res.status(500).json({ message })
  }
}

type PatchBody = {
  updates?: Array<{ order_id: string; include: boolean }>
}

/** PATCH /admin/gst-filing/records — toggle include_in_gst per order */
export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = (req.body ?? {}) as PatchBody
  const updates = body.updates

  if (!Array.isArray(updates) || !updates.length) {
    res.status(400).json({ message: "updates array is required" })
    return
  }

  try {
    const result = await updateGstRecordInclusion(req.scope, updates)
    res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update GST records"
    res.status(500).json({ message })
  }
}
