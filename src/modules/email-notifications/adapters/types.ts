export type EmailPayload = {
  to: string
  subject: string
  html: string
}

export type EmailSenderAdapter = {
  readonly name: string
  send(message: EmailPayload): Promise<{ id: string }>
}

export type SmtpAdapterOptions = {
  from: string
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}
