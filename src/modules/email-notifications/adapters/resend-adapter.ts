import type { Logger } from "@medusajs/framework/types"
import { Resend } from "resend"
import type { EmailPayload, EmailSenderAdapter } from "./types"

export class ResendEmailAdapter implements EmailSenderAdapter {
  readonly name = "resend"
  private client: Resend
  private from: string
  private logger: Logger

  constructor(logger: Logger, apiKey: string, from: string) {
    this.logger = logger
    this.from = from
    this.client = new Resend(apiKey)
  }

  async send(message: EmailPayload): Promise<{ id: string }> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    })

    if (error) {
      throw new Error(error.message)
    }

    const id = data?.id ?? "resend-sent"
    this.logger.info(`[email:${this.name}] Sent to ${message.to} (${id})`)
    return { id }
  }
}
