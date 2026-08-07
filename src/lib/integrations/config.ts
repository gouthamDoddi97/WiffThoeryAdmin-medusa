/** Shared integration flags — safe defaults when credentials are missing. */

export function isRazorpayConfigured(): boolean {
  const keyId =
    process.env.RAZORPAY_KEY_ID ??
    process.env.RAZORPAY_TEST_KEY_ID ??
    process.env.RAZORPAY_ID
  const keySecret =
    process.env.RAZORPAY_KEY_SECRET ??
    process.env.RAZORPAY_TEST_KEY_SECRET ??
    process.env.RAZORPAY_SECRET
  return Boolean(keyId && keySecret)
}

export function isShiprocketConfigured(): boolean {
  const password =
    process.env.SHIPROCKET_PASSWORD ??
    process.env.SHIPROCKET_API_KEY ??
    process.env.NEXT_SHIPROCKET_API_KEY
  return Boolean(process.env.SHIPROCKET_EMAIL && password)
}

export function getShiprocketPassword(): string | undefined {
  return (
    process.env.SHIPROCKET_PASSWORD ??
    process.env.SHIPROCKET_API_KEY ??
    process.env.NEXT_SHIPROCKET_API_KEY
  )
}

/** Demo mode logs shipments instead of calling Shiprocket (default when creds missing). */
export function isShiprocketDemoMode(): boolean {
  if (process.env.SHIPROCKET_DEMO_MODE === "false") {
    return false
  }
  if (process.env.SHIPROCKET_DEMO_MODE === "true") {
    return true
  }
  return !isShiprocketConfigured()
}

/** Live Shiprocket courier list at checkout (requires credentials). */
export function isShiprocketLiveCheckoutEnabled(): boolean {
  if (process.env.SHIPROCKET_LIVE_CHECKOUT === "false") {
    return false
  }
  return isShiprocketConfigured()
}

export function getRazorpayOptions() {
  return {
    key_id:
      process.env.RAZORPAY_KEY_ID ??
      process.env.RAZORPAY_TEST_KEY_ID ??
      process.env.RAZORPAY_ID ??
      "",
    key_secret:
      process.env.RAZORPAY_KEY_SECRET ??
      process.env.RAZORPAY_TEST_KEY_SECRET ??
      process.env.RAZORPAY_SECRET ??
      "",
    razorpay_account:
      process.env.RAZORPAY_TEST_ACCOUNT ?? process.env.RAZORPAY_ACCOUNT,
    automatic_expiry_period: 30,
    manual_expiry_period: 20,
    refund_speed: "normal" as const,
    webhook_secret:
      process.env.RAZORPAY_TEST_WEBHOOK_SECRET ??
      process.env.RAZORPAY_WEBHOOK_SECRET,
    auto_capture: process.env.RAZORPAY_AUTO_CAPTURE !== "false",
  }
}
