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
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <a href="${BASE_URL}" style="text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.2em;color:#ffffff;">WHIFF THEORY</a>
          </td>
        </tr>
        <tr><td style="padding:40px 40px 32px;">${content}</td></tr>
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

export function welcomeTemplate(data: Record<string, unknown>): string {
  const customer = data.customer as Record<string, unknown> | undefined
  const firstName =
    (data.first_name as string | null | undefined) ??
    (customer?.first_name as string | null | undefined) ??
    "there"

  const content = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;color:#4FDBCC;text-transform:uppercase;">Welcome</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">
      You're in, ${firstName}.
    </h1>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;">
      Welcome to Whiff Theory — artisan fragrances crafted in Visakhapatnam.
      Three tiers. One journey. No compromises.
    </p>
    <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;">
      Start by finding your scent personality, or browse our collections below.
    </p>

    <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding-right:12px;">
          <a href="${BASE_URL}/journey"
             style="display:inline-block;padding:14px 28px;background:#4FDBCC;color:#0f1017;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;">
            SCENT PERSONALITY
          </a>
        </td>
        <td>
          <a href="${BASE_URL}/store"
             style="display:inline-block;padding:13px 28px;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;">
            BROWSE CATALOG
          </a>
        </td>
      </tr>
    </table>
  `

  return layout(content)
}
