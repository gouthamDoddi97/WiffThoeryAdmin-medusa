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

export function passwordResetTemplate(data: Record<string, unknown>): string {
  const resetUrl = data.url as string ?? data.reset_url as string ?? "#"
  const email = data.email as string ?? ""

  const content = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;color:#FFB547;text-transform:uppercase;">Password Reset</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">Reset your password</h1>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;">
      We received a request to reset the password for your account${email ? ` (<strong style="color:rgba(255,255,255,0.7);">${email}</strong>)` : ""}.
    </p>
    <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;">
      Click the button below to choose a new password. This link expires in <strong style="color:#ffffff;">30 minutes</strong>.
    </p>

    <a href="${resetUrl}"
       style="display:inline-block;padding:14px 32px;background:#FFB547;color:#0f1017;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;">
      RESET PASSWORD
    </a>

    <p style="margin:32px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
      If you didn't request this, you can safely ignore this email. Your password will not change.
    </p>
  `

  return layout(content)
}
