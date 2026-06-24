import type { Logger } from "@medusajs/framework/types"
import type { EmailPayload, EmailSenderAdapter, SmtpAdapterOptions } from "./types"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer") as {
  createTransport: (opts: Record<string, unknown>) => {
    sendMail: (msg: Record<string, unknown>) => Promise<{ messageId: string }>
  }
}

export class NodemailerEmailAdapter implements EmailSenderAdapter {
  readonly name = "nodemailer"
  private transporter: ReturnType<typeof nodemailer.createTransport>
  private from: string
  private logger: Logger

  constructor(logger: Logger, options: SmtpAdapterOptions) {
    this.logger = logger
    this.from = options.from
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.auth,
    })
  }

  async send(message: EmailPayload): Promise<{ id: string }> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    })
    this.logger.info(`[email:${this.name}] Sent to ${message.to} (${info.messageId})`)
    return { id: info.messageId }
  }
}
