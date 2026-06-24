import { AbstractNotificationProviderService } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { createEmailAdapter } from "./adapters/create-email-adapter"
import type { EmailSenderAdapter, SmtpAdapterOptions } from "./adapters/types"
import { renderEmail } from "./templates/render-email"

type Options = {
  from?: string
  host?: string
  port?: number
  secure?: boolean
  auth?: {
    user?: string
    pass?: string
  }
}

type InjectedDependencies = {
  logger: Logger
}

class NodemailerNotificationService extends AbstractNotificationProviderService {
  static identifier = "nodemailer"

  private adapter: EmailSenderAdapter | null
  private logger: Logger

  constructor({ logger }: InjectedDependencies, options: Options) {
    super()
    this.logger = logger

    const smtpOptions: Partial<SmtpAdapterOptions> = {
      from: options.from,
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.auth as SmtpAdapterOptions["auth"] | undefined,
    }

    this.adapter = createEmailAdapter(logger, smtpOptions)
  }

  async send(notification: {
    to: string
    channel: string
    template: string
    data: Record<string, unknown>
  }): Promise<{ id: string }> {
    const { to, template, data } = notification

    if (!this.adapter) {
      this.logger.warn(`[email] Skipped ${template} to ${to} — no adapter configured`)
      return { id: "email-not-configured" }
    }

    const rendered = renderEmail(template, data)
    if (!rendered) {
      this.logger.warn(`[email:${this.adapter.name}] Unknown template: ${template}`)
      return { id: "unknown-template" }
    }

    try {
      return await this.adapter.send({
        to,
        subject: rendered.subject,
        html: rendered.html,
      })
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(
          `[email:${this.adapter.name}] Failed to send ${template} to ${to}`,
          err
        )
        throw err
      }
      this.logger.error(
        `[email:${this.adapter.name}] Failed to send ${template} to ${to}`,
        err as Error
      )
      throw err
    }
  }
}

export default NodemailerNotificationService
