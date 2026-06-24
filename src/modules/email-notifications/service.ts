import { AbstractNotificationProviderService } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { orderConfirmedTemplate } from "./templates/order-confirmed"
import { passwordResetTemplate } from "./templates/password-reset"
import { welcomeTemplate } from "./templates/welcome"
import { taskNotificationTemplate } from "./templates/task-notification"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer") as {
  createTransport: (opts: Record<string, unknown>) => {
    sendMail: (msg: Record<string, unknown>) => Promise<{ messageId: string }>
  }
}

type Options = {
  from: string
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

type InjectedDependencies = {
  logger: Logger
}

class NodemailerNotificationService extends AbstractNotificationProviderService {
  static identifier = "nodemailer"

  private transporter: ReturnType<typeof nodemailer.createTransport>
  private from: string
  private logger: Logger

  constructor({ logger }: InjectedDependencies, options: Options) {
    super()
    this.logger = logger
    this.from = options.from

    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.auth,
    })
  }

  async send(notification: {
    to: string
    channel: string
    template: string
    data: Record<string, unknown>
  }): Promise<{ id: string }> {
    const { to, template, data } = notification

    let subject = ""
    let html = ""

    switch (template) {
      case "order-confirmed":
        subject = `Your Whiff Theory order is confirmed`
        html = orderConfirmedTemplate(data)
        break
      case "password-reset":
        subject = `Reset your Whiff Theory password`
        html = passwordResetTemplate(data)
        break
      case "welcome":
        subject = `Welcome to Whiff Theory`
        html = welcomeTemplate(data)
        break
      case "task-assigned":
        subject = `[Whiff Theory] New task: ${(data.task as { title?: string })?.title ?? "Assigned to you"}`
        html = taskNotificationTemplate({ ...data, event: "created" })
        break
      case "task-updated":
        subject = `[Whiff Theory] Task updated: ${(data.task as { title?: string })?.title ?? "Task"}`
        html = taskNotificationTemplate({ ...data, event: "updated" })
        break
      default:
        this.logger.warn(`[nodemailer] Unknown template: ${template}`)
        return { id: "unknown-template" }
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      })
      this.logger.info(`[nodemailer] Email sent to ${to} (${info.messageId})`)
      return { id: info.messageId }
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`[nodemailer] Failed to send email to ${to}`, err)
        throw err
      }
      this.logger.error(`[nodemailer] Failed to send email to ${to}`, err as any)
      throw err
    }
  }
}

export default NodemailerNotificationService
