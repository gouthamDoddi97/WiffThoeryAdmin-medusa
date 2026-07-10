import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { getRazorpayOptions, isRazorpayConfigured } from './src/lib/integrations/config'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const paymentProviders: Array<{
  resolve: string
  id: string
  options?: Record<string, unknown>
}> = []

if (isRazorpayConfigured()) {
  paymentProviders.push({
    resolve: '@sgftech/payment-razorpay',
    id: 'razorpay',
    options: getRazorpayOptions(),
  })
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.S3_FILE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: "auto",
              bucket: process.env.S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT,
              additional_client_config: {
                requestChecksumCalculation: "WHEN_REQUIRED",
                responseChecksumValidation: "WHEN_REQUIRED",
              },
            },
          },
        ],
      },
    },
    {
      resolve: "./src/modules/perfume-details",
    },
    {
      resolve: "./src/modules/collection-background",
    },
    {
      resolve: "./src/modules/collection-tier",
    },
    {
      resolve: "./src/modules/ugc-gallery",
    },
    {
      resolve: "./src/modules/fragrance-notes",
    },
    {
      resolve: "./src/modules/product-reviews",
    },
    {
      resolve: "./src/modules/offers",
    },
    {
      resolve: "./src/modules/budget-finance",
    },
    ...(paymentProviders.length
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: paymentProviders,
            },
          },
        ]
      : []),
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/email-notifications",
            id: "nodemailer",
            options: {
              channels: ["email"],
              from: process.env.SMTP_FROM,
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT ?? 587),
              secure: process.env.SMTP_SECURE === "true",
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            },
          },
        ],
      },
    },
  ],
})
