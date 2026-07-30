const BASE_URL = process.env.STOREFRONT_URL || "https://www.whiff-theory.com"

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Whiff Theory</title>
</head>
<body style="margin:0;padding:0;background:#0f1017;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1017;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1c28;border:1px solid rgba(255,255,255,0.06);">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <a href="${BASE_URL}" style="text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.2em;color:#ffffff;">WHIFF THEORY</a>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.12em;">
              CRAFTED IN VIZAG. FOR THE WORLD.<br/>
              <a href="${BASE_URL}" style="color:rgba(255,255,255,0.3);text-decoration:none;">${BASE_URL.replace(/^https?:\/\//, "")}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function orderShippedTemplate(data: Record<string, unknown>): string {
  const order = data.order as any
  const shipment = (data.shipment ?? {}) as {
    awb?: string
    courier?: string
    status?: string
    etd?: string
  }

  const displayId = order?.display_id ?? "—"
  const customerName =
    order?.customer?.first_name || order?.shipping_address?.first_name || "there"
  const trackUrl = `${BASE_URL}/track/${encodeURIComponent(shipment.awb ?? "")}`

  const detailRow = (label: string, value?: string) =>
    value
      ? `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;letter-spacing:0.14em;color:rgba(255,255,255,0.4);text-transform:uppercase;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;font-size:13px;color:#ffffff;">${value}</td>
    </tr>`
      : ""

  const content = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;color:#4FDBCC;text-transform:uppercase;">On Its Way</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">Your order has shipped, ${customerName}.</h1>
    <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;">
      Order <strong style="color:#ffffff;">#${displayId}</strong> is on its way to you.
      Track its journey any time with the link below.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      ${detailRow("Courier", shipment.courier)}
      ${detailRow("Tracking number", shipment.awb)}
      ${detailRow("Expected delivery", shipment.etd)}
    </table>

    <a href="${trackUrl}"
       style="display:inline-block;padding:14px 32px;background:#4FDBCC;color:#0f1017;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;">
      TRACK YOUR ORDER
    </a>
  `

  return layout(content)
}
