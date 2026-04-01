const BASE_URL = process.env.STOREFRONT_URL || "https://whifftheory.com"

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

export function orderConfirmedTemplate(data: Record<string, unknown>): string {
  const order = data.order as any
  const displayId = order?.display_id ?? order?.id ?? "—"
  const customerName = order?.customer?.first_name || order?.billing_address?.first_name || "there"
  const items: any[] = order?.items ?? []
  const total = order?.total ?? order?.summary?.current_order_total ?? 0
  const currency = (order?.currency_code ?? "inr").toUpperCase()
  const currencySymbol = currency === "INR" ? "₹" : "$"

  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <p style="margin:0;font-size:13px;color:#ffffff;">${item.title ?? item.product_title ?? "Product"}</p>
        ${item.variant_title ? `<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.4);">${item.variant_title}</p>` : ""}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;vertical-align:top;">
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">× ${item.quantity}</p>
      </td>
    </tr>
  `).join("")

  const content = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;color:#4FDBCC;text-transform:uppercase;">Order Confirmed</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">Thank you, ${customerName}.</h1>
    <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;">
      Your order <strong style="color:#ffffff;">#${displayId}</strong> has been received and is being processed.
      We'll send another email once it ships.
    </p>

    <!-- Items -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${itemRows}
      <tr>
        <td style="padding:16px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Total</td>
        <td style="padding:16px 0 0;text-align:right;font-size:16px;font-weight:600;color:#4FDBCC;">
          ${currencySymbol}${(total / 100).toFixed(2)}
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <a href="${BASE_URL}/account/orders/${order?.id}"
       style="display:inline-block;padding:14px 32px;background:#4FDBCC;color:#0f1017;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;">
      VIEW ORDER
    </a>
  `

  return layout(content)
}
