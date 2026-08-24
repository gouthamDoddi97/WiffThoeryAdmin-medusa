import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { buildGstFilingExport } from "../../../lib/gst-filing/build-gst-filing-export"
import type { GstFilingFilters } from "../../../lib/gst-filing/build-gstr1-json"
import { readGstFilingConfig } from "../../../lib/gst-filing/load-orders-for-period"

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

/** GET /admin/gst-filing?year=2026&month=8 — GSTR-1 + input tax report */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const period = parseYearMonth(req)
  if (!period) {
    res.status(400).json({
      message: "Query params year (YYYY) and month (1–12) are required",
    })
    return
  }

  const config = readGstFilingConfig()
  if (!config.gstin) {
    res.status(400).json({
      message:
        "Set GST_SUPPLIER_GSTIN in the Medusa .env file (15-character GSTIN of your business)",
    })
    return
  }

  if (config.gstin.length !== 15) {
    res.status(400).json({
      message: "GST_SUPPLIER_GSTIN must be a 15-character GSTIN",
    })
    return
  }

  try {
    const filters = parseFilters(req)
    const exportData = await buildGstFilingExport(req.scope, {
      year: period.year,
      month: period.month,
      filters,
    })

    const download = req.query.download
    if (download === "1" || download === "true" || download === "gstr1") {
      res.setHeader("Content-Type", "application/json")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportData.filename}"`
      )
      res.send(JSON.stringify(exportData.gstr1, null, 2))
      return
    }

    if (download === "full") {
      res.setHeader("Content-Type", "application/json")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportData.full_report_filename}"`
      )
      res.send(
        JSON.stringify(
          {
            gstr1: exportData.gstr1,
            input_tax: exportData.input_tax,
            filters,
            summary: exportData.summary,
          },
          null,
          2
        )
      )
      return
    }

    res.json({
      summary: exportData.summary,
      gstr1: exportData.gstr1,
      input_tax: exportData.input_tax,
      filters,
      filename: exportData.filename,
      full_report_filename: exportData.full_report_filename,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build GST report"
    res.status(500).json({ message })
  }
}
