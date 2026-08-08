import PDFDocument from "pdfkit"
import type { OrderLabelData } from "./load-order-label-data"
import { renderCode128Barcode } from "./barcode"

/** PDF points per millimetre (72 pt / inch, 25.4 mm / inch). */
const PT_PER_MM = 72 / 25.4

function mmToPt(mm: number): number {
  return mm * PT_PER_MM
}

/** Physical label: 10 cm × 15 cm (common thermal sticker). */
const LABEL_WIDTH = mmToPt(100)
const LABEL_HEIGHT = mmToPt(150)

/** Inset for die-cut / registration border (1.5 mm from sticker edge). */
const BORDER_INSET = mmToPt(1.5)

/** Non-printable safe zone — keep content inside this (3 mm from edge). */
const SAFE_MARGIN = mmToPt(3)

const CONTENT_X = SAFE_MARGIN
const CONTENT_Y = SAFE_MARGIN
const CONTENT_WIDTH = LABEL_WIDTH - SAFE_MARGIN * 2
const CONTENT_HEIGHT = LABEL_HEIGHT - SAFE_MARGIN * 2
const GAP = mmToPt(2)

/** Thermal printers are monochrome — stick to solid black strokes and fills. */
const COLORS = {
  ink: "#000000",
  white: "#ffffff",
}

const MAX_ADDRESS_LINES = 4
const MAX_VISIBLE_ITEMS = 4

function formatMoney(amount: number, currency: string): string {
  if (currency.toUpperCase() === "INR") {
    return `Rs. ${amount.toFixed(2)}`
  }
  return `${amount.toFixed(2)} ${currency}`
}

function truncateLines(lines: string[], max: number): string[] {
  if (lines.length <= max) {
    return lines
  }
  const kept = lines.slice(0, max - 1)
  const rest = lines.slice(max - 1).join(", ")
  kept.push(rest.length > 42 ? `${rest.slice(0, 39)}…` : rest)
  return kept
}

function textHeight(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  options: { width: number; font?: string; size?: number; lineGap?: number }
): number {
  const { width, font = "Helvetica", size = 8, lineGap = 0.5 } = options
  doc.font(font).fontSize(size)
  return doc.heightOfString(text, { width, lineGap })
}

function drawLabelBorder(doc: InstanceType<typeof PDFDocument>) {
  doc
    .rect(
      BORDER_INSET,
      BORDER_INSET,
      LABEL_WIDTH - BORDER_INSET * 2,
      LABEL_HEIGHT - BORDER_INSET * 2
    )
    .lineWidth(0.6)
    .stroke(COLORS.ink)
}

function drawAddressBox(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  title: string,
  subtitle: string | undefined,
  lines: string[]
): number {
  const pad = mmToPt(1.5)
  const innerWidth = width - pad * 2
  const bodyLines = truncateLines(lines, MAX_ADDRESS_LINES)

  const titleHeight = textHeight(doc, title, {
    width: innerWidth,
    font: "Helvetica-Bold",
    size: 7,
  })
  const subtitleHeight = subtitle
    ? textHeight(doc, subtitle, { width: innerWidth, size: 5.5 }) + 1
    : 0
  const bodyHeight = textHeight(doc, bodyLines.join("\n"), {
    width: innerWidth,
    lineGap: 0.5,
    size: 7,
  })
  const height = pad + titleHeight + subtitleHeight + bodyHeight + pad

  doc.rect(x, y, width, height).lineWidth(0.6).stroke(COLORS.ink)
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(COLORS.ink)
    .text(title, x + pad, y + pad, { width: innerWidth })

  if (subtitle) {
    doc
      .font("Helvetica")
      .fontSize(5.5)
      .text(subtitle, x + pad, doc.y, { width: innerWidth })
  }

  doc
    .font("Helvetica")
    .fontSize(7)
    .text(bodyLines.join("\n"), x + pad, doc.y + 1, {
      width: innerWidth,
      lineGap: 0.5,
    })

  return height
}

function drawBarcodePanel(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  title: string,
  barcode: Buffer,
  caption: string,
  panelHeight: number
): number {
  const pad = mmToPt(1.5)
  const innerWidth = width - pad * 2

  doc.rect(x, y, width, panelHeight).lineWidth(0.5).stroke(COLORS.ink)
  doc
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .fillColor(COLORS.ink)
    .text(title, x + pad, y + pad, { width: innerWidth })

  const barcodeY = y + pad + mmToPt(3)
  const barcodeHeight = panelHeight - pad * 2 - mmToPt(9)
  doc.image(barcode, x + pad, barcodeY, {
    fit: [innerWidth, barcodeHeight],
    align: "center",
  })

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(caption, x + pad, y + panelHeight - pad - 7, {
      width: innerWidth,
      align: "center",
    })

  return panelHeight
}

function drawPendingAwbPanel(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  panelHeight: number
): number {
  const pad = mmToPt(2)

  doc
    .rect(x, y, width, panelHeight)
    .lineWidth(0.6)
    .dash(4, { space: 3 })
    .stroke(COLORS.ink)
    .undash()

  doc
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .fillColor(COLORS.ink)
    .text("AWB barcode", x + pad, y + pad, { width: width - pad * 2 })

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("PENDING", x + pad, y + mmToPt(8), {
      width: width - pad * 2,
      align: "center",
    })

  doc
    .font("Helvetica")
    .fontSize(6)
    .text("Assign courier in Shiprocket", x + pad, y + mmToPt(14), {
      width: width - pad * 2,
      align: "center",
      lineGap: 0.5,
    })

  return panelHeight
}

function drawPaymentBadge(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  mode: "Prepaid" | "COD"
): number {
  const label = mode === "Prepaid" ? "PREPAID" : "COD"
  const width = mode === "Prepaid" ? mmToPt(14) : mmToPt(10)
  const height = mmToPt(4.5)

  doc.rect(x, y, width, height).fill(COLORS.ink)
  doc
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .fillColor(COLORS.white)
    .text(label, x, y + 1, { width, align: "center" })

  doc.fillColor(COLORS.ink)
  return width
}

function drawMetaGrid(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  data: OrderLabelData
): number {
  const rowHeight = mmToPt(4.2)
  const colWidth = width / 2
  const gridHeight = rowHeight * 3

  doc.rect(x, y, width, gridHeight).lineWidth(0.5).stroke(COLORS.ink)

  const rows: Array<[string, string, string, string]> = [
    ["Order", data.orderBarcode, "Date", data.orderDate],
    [
      "Items",
      formatMoney(data.itemSubtotal, data.currencyCode),
      "Shipping",
      formatMoney(data.shippingTotal, data.currencyCode),
    ],
    [
      data.paymentMode === "Prepaid" ? "Paid" : "Collect",
      formatMoney(data.orderTotal, data.currencyCode),
      "Weight",
      `${data.weightKg.toFixed(2)} kg`,
    ],
  ]

  rows.forEach(([labelL, valueL, labelR, valueR], row) => {
    const cellY = y + row * rowHeight

    if (row > 0) {
      doc
        .moveTo(x, cellY)
        .lineTo(x + width, cellY)
        .lineWidth(0.4)
        .stroke(COLORS.ink)
    }

    doc.font("Helvetica").fontSize(5.5).text(labelL, x + 3, cellY + 2, { width: 32 })
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .text(valueL, x + 34, cellY + 1.5, { width: colWidth - 38 })

    doc.font("Helvetica").fontSize(5.5).text(labelR, x + colWidth + 3, cellY + 2, {
      width: 32,
    })
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .text(valueR, x + colWidth + 34, cellY + 1.5, { width: colWidth - 38 })
  })

  doc
    .moveTo(x + colWidth, y)
    .lineTo(x + colWidth, y + gridHeight)
    .lineWidth(0.4)
    .stroke(COLORS.ink)

  return gridHeight
}

function drawItemsTable(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  data: OrderLabelData
): number {
  const itemCol = Math.round(width * 0.46)
  const skuCol = Math.round(width * 0.2)
  const qtyCol = Math.round(width * 0.1)
  const totalCol = width - itemCol - skuCol - qtyCol

  const columns = [
    { label: "Item", width: itemCol, align: "left" as const },
    { label: "SKU", width: skuCol, align: "left" as const },
    { label: "Qty", width: qtyCol, align: "center" as const },
    { label: "Total", width: totalCol, align: "right" as const },
  ]

  const headerHeight = mmToPt(4)
  const rowHeight = mmToPt(3.8)
  const visibleItems = data.items.slice(0, MAX_VISIBLE_ITEMS)
  const extraRow = data.items.length > MAX_VISIBLE_ITEMS ? rowHeight : 0
  const tableHeight = headerHeight + visibleItems.length * rowHeight + extraRow

  doc.rect(x, y, width, tableHeight).lineWidth(0.5).stroke(COLORS.ink)

  let colX = x + 3
  doc.font("Helvetica-Bold").fontSize(6.5)
  for (const col of columns) {
    doc.text(col.label, colX, y + 2, {
      width: col.width - 4,
      align: col.align,
    })
    colX += col.width
  }

  doc
    .moveTo(x, y + headerHeight)
    .lineTo(x + width, y + headerHeight)
    .lineWidth(0.4)
    .stroke(COLORS.ink)

  let rowY = y + headerHeight
  doc.font("Helvetica").fontSize(6.5)
  for (const item of visibleItems) {
    colX = x + 3
    const values = [
      item.title.slice(0, 22),
      (item.sku ?? "—").slice(0, 10),
      String(item.quantity),
      formatMoney(item.lineTotal, data.currencyCode),
    ]

    values.forEach((value, index) => {
      doc.text(value, colX, rowY + 1.5, {
        width: columns[index].width - 4,
        align: columns[index].align,
      })
      colX += columns[index].width
    })

    rowY += rowHeight
    if (rowY < y + tableHeight) {
      doc
        .moveTo(x, rowY)
        .lineTo(x + width, rowY)
        .lineWidth(0.35)
        .stroke(COLORS.ink)
    }
  }

  if (data.items.length > MAX_VISIBLE_ITEMS) {
    doc
      .font("Helvetica")
      .fontSize(6)
      .text(`+ ${data.items.length - MAX_VISIBLE_ITEMS} more`, x + 3, rowY + 1, {
        width: width - 6,
      })
  }

  return tableHeight
}

export async function generatePackingLabelPdf(
  data: OrderLabelData
): Promise<Buffer> {
  const orderBarcode = await renderCode128Barcode(data.orderBarcode, {
    height: 10,
    scale: 2,
    includeText: false,
  })

  const awbBarcode = data.awb
    ? await renderCode128Barcode(data.awb, {
        height: 10,
        scale: 2,
        includeText: false,
      })
    : null

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [LABEL_WIDTH, LABEL_HEIGHT],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    })

    const chunks: Buffer[] = []
    doc.on("data", (chunk) => chunks.push(chunk as Buffer))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    drawLabelBorder(doc)

    let cursorY = CONTENT_Y

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLORS.ink)
      .text(data.brandName.toUpperCase(), CONTENT_X, cursorY, {
        width: CONTENT_WIDTH,
        align: "center",
      })
    cursorY = doc.y + 1

    doc
      .font("Helvetica")
      .fontSize(6)
      .text("Packing label — affix before fulfillment", CONTENT_X, cursorY, {
        width: CONTENT_WIDTH,
        align: "center",
      })
    cursorY = doc.y + mmToPt(2)

    doc
      .moveTo(CONTENT_X, cursorY)
      .lineTo(CONTENT_X + CONTENT_WIDTH, cursorY)
      .lineWidth(0.4)
      .stroke(COLORS.ink)
    cursorY += GAP

    const boxWidth = (CONTENT_WIDTH - GAP) / 2
    const barcodePanelHeight = mmToPt(21)

    const shipToLines = [
      data.customer.name,
      ...data.customer.addressLines,
      data.customer.phone ? `Ph: ${data.customer.phone}` : "",
    ].filter(Boolean)

    const shipFromLines = [
      data.shipFrom.name,
      ...data.shipFrom.addressLines,
      data.shipFrom.phone ? `Ph: ${data.shipFrom.phone}` : "",
    ].filter(Boolean)

    const leftBoxHeight = drawAddressBox(
      doc,
      CONTENT_X,
      cursorY,
      boxWidth,
      "Ship To",
      undefined,
      shipToLines
    )

    const rightBoxHeight = drawAddressBox(
      doc,
      CONTENT_X + boxWidth + GAP,
      cursorY,
      boxWidth,
      "Return To",
      "If undelivered",
      shipFromLines
    )

    cursorY += Math.max(leftBoxHeight, rightBoxHeight) + GAP

    drawBarcodePanel(
      doc,
      CONTENT_X,
      cursorY,
      boxWidth,
      "Order",
      orderBarcode,
      data.orderBarcode,
      barcodePanelHeight
    )

    if (awbBarcode && data.awb) {
      drawBarcodePanel(
        doc,
        CONTENT_X + boxWidth + GAP,
        cursorY,
        boxWidth,
        "AWB",
        awbBarcode,
        data.awb,
        barcodePanelHeight
      )
    } else {
      drawPendingAwbPanel(
        doc,
        CONTENT_X + boxWidth + GAP,
        cursorY,
        boxWidth,
        barcodePanelHeight
      )
    }

    cursorY += barcodePanelHeight + GAP

    const badgeWidth = drawPaymentBadge(doc, CONTENT_X, cursorY, data.paymentMode)
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .text("Order details", CONTENT_X + badgeWidth + mmToPt(2), cursorY + 1)

    cursorY += mmToPt(5.5)
    const metaHeight = drawMetaGrid(doc, CONTENT_X, cursorY, CONTENT_WIDTH, data)
    cursorY += metaHeight + mmToPt(1.5)

    if (data.courier) {
      doc
        .font("Helvetica")
        .fontSize(6)
        .text(
          `Courier: ${data.courier.slice(0, 32)} · Qty: ${data.items.reduce((sum, item) => sum + item.quantity, 0)}`,
          CONTENT_X,
          cursorY,
          { width: CONTENT_WIDTH }
        )
      cursorY += mmToPt(3)
    }

    doc.font("Helvetica-Bold").fontSize(6.5).text("Items", CONTENT_X, cursorY)
    cursorY += mmToPt(3.5)
    drawItemsTable(doc, CONTENT_X, cursorY, CONTENT_WIDTH, data)

    const footerY = CONTENT_Y + CONTENT_HEIGHT - mmToPt(9)
    doc
      .font("Helvetica")
      .fontSize(5.5)
      .text(
        `Support: ${data.supportPhone} · ${data.supportEmail}`,
        CONTENT_X,
        footerY,
        { width: CONTENT_WIDTH, align: "center" }
      )
    doc.text(
      "Scan order at packing · Scan AWB at dispatch",
      CONTENT_X,
      footerY + mmToPt(3.5),
      { width: CONTENT_WIDTH, align: "center" }
    )

    doc.end()
  })
}

/** Exported for tests / print driver configuration. */
export const LABEL_SIZE_MM = { width: 100, height: 150 } as const
