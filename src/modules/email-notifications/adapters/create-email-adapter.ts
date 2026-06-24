import type { Logger } from "@medusajs/framework/types"
import { NodemailerEmailAdapter } from "./nodemailer-adapter"
import { ResendEmailAdapter } from "./resend-adapter"
import type { EmailSenderAdapter, SmtpAdapterOptions } from "./types"

export function resolveEmailFromAddress(smtpFrom?: string): string {
  return (
    process.env.RESEND_FROM?.trim() ||
    smtpFrom?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "Whiff Theory <hello@whiff-theory.com>"
  )
}

export function createEmailAdapter(
  logger: Logger,
  smtpOptions?: Partial<SmtpAdapterOptions>
): EmailSenderAdapter | null {
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const from = resolveEmailFromAddress(smtpOptions?.from)

  if (resendKey) {
    logger.info(`[email] Using Resend adapter (from: ${from})`)
    return new ResendEmailAdapter(logger, resendKey, from)
  }

  if (
    smtpOptions?.host &&
    smtpOptions.auth?.user &&
    smtpOptions.auth?.pass &&
    smtpOptions.from
  ) {
    logger.info(`[email] Using Nodemailer SMTP adapter (from: ${smtpOptions.from})`)
    return new NodemailerEmailAdapter(logger, {
      from: smtpOptions.from,
      host: smtpOptions.host,
      port: smtpOptions.port ?? 587,
      secure: smtpOptions.secure ?? false,
      auth: smtpOptions.auth,
    })
  }

  logger.warn("[email] No email adapter configured (set RESEND_API_KEY or SMTP_* env vars)")
  return null
}

export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY?.trim()) return true
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  )
}
