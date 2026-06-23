import { Migration } from "@medusajs/framework/mikro-orm/migrations"

function tableSql(name: string, columns: string): string {
  return (
    `create table if not exists "${name}" (` +
    columns +
    `"created_at" timestamptz not null default now(), ` +
    `"updated_at" timestamptz not null default now(), ` +
    `"deleted_at" timestamptz null, ` +
    `constraint "${name}_pkey" primary key ("id")` +
    `);`
  )
}

export class Migration20260623120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      tableSql(
        "budget_expense_category",
        `"id" text not null, ` +
          `"name" text not null, ` +
          `"slug" text not null, ` +
          `"description" text null, ` +
          `"sort_order" integer not null default 0, ` +
          `"is_active" boolean not null default true, `
      )
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_budget_expense_category_slug" ON "budget_expense_category" ("slug") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      tableSql(
        "budget_expense",
        `"id" text not null, ` +
          `"category_id" text not null, ` +
          `"amount" numeric not null, ` +
          `"currency_code" text not null default 'inr', ` +
          `"expense_date" timestamptz not null, ` +
          `"vendor" text null, ` +
          `"payment_method" text not null default 'upi', ` +
          `"description" text not null, ` +
          `"funding_source_id" text null, ` +
          `"business_event_id" text null, ` +
          `"recorded_by" text not null, ` +
          `"notes" text null, ` +
          `"receipt_url" text null, `
      )
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_expense_category_id" ON "budget_expense" ("category_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_expense_date" ON "budget_expense" ("expense_date") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      tableSql(
        "budget_monthly_budget",
        `"id" text not null, ` +
          `"category_id" text not null, ` +
          `"year" integer not null, ` +
          `"month" integer not null, ` +
          `"amount" numeric not null, ` +
          `"currency_code" text not null default 'inr', `
      )
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_budget_monthly_budget_period" ON "budget_monthly_budget" ("category_id", "year", "month") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      tableSql(
        "budget_cash_snapshot",
        `"id" text not null, ` +
          `"snapshot_date" timestamptz not null, ` +
          `"bank_balance" numeric not null, ` +
          `"cash_in_hand" numeric not null default 0, ` +
          `"currency_code" text not null default 'inr', ` +
          `"notes" text null, ` +
          `"recorded_by" text not null, `
      )
    )

    this.addSql(
      tableSql(
        "budget_funding_source",
        `"id" text not null, ` +
          `"type" text not null, ` +
          `"label" text not null, ` +
          `"founder_key" text null, ` +
          `"principal_amount" numeric null, ` +
          `"interest_rate" numeric null, ` +
          `"tenure_months" integer null, ` +
          `"emi_amount" numeric null, ` +
          `"disbursement_date" timestamptz null, ` +
          `"maturity_date" timestamptz null, ` +
          `"status" text not null default 'active', ` +
          `"notes" text null, ` +
          `"use_of_funds_notes" text null, `
      )
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_funding_source_type" ON "budget_funding_source" ("type") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      tableSql(
        "budget_funding_transaction",
        `"id" text not null, ` +
          `"funding_source_id" text not null, ` +
          `"type" text not null, ` +
          `"amount" numeric not null, ` +
          `"transaction_date" timestamptz not null, ` +
          `"notes" text null, ` +
          `"recorded_by" text not null, `
      )
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_funding_tx_source" ON "budget_funding_transaction" ("funding_source_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      tableSql(
        "budget_funding_allocation",
        `"id" text not null, ` +
          `"funding_source_id" text not null, ` +
          `"category_id" text not null, ` +
          `"planned_amount" numeric not null, ` +
          `"notes" text null, `
      )
    )

    this.addSql(
      tableSql(
        "budget_product_cost_sheet",
        `"id" text not null, ` +
          `"name" text not null, ` +
          `"product_id" text null, ` +
          `"variant_id" text null, ` +
          `"line_type" text not null default 'core', ` +
          `"fragrance_cost" numeric not null default 0, ` +
          `"alcohol_cost" numeric not null default 0, ` +
          `"bottle_cost" numeric not null default 0, ` +
          `"cap_cost" numeric not null default 0, ` +
          `"label_cost" numeric not null default 0, ` +
          `"box_cost" numeric not null default 0, ` +
          `"filling_cost" numeric not null default 0, ` +
          `"packaging_other" numeric not null default 0, ` +
          `"batch_quantity" integer not null default 0, ` +
          `"units_sold" integer not null default 0, ` +
          `"retail_price" numeric not null default 0, ` +
          `"avg_discount_percent" numeric not null default 0, ` +
          `"notes" text null, `
      )
    )

    this.addSql(
      tableSql(
        "budget_business_event",
        `"id" text not null, ` +
          `"name" text not null, ` +
          `"event_date" timestamptz not null, ` +
          `"location" text null, ` +
          `"notes" text null, `
      )
    )

    this.addSql(
      tableSql(
        "budget_settings",
        `"id" text not null, ` +
          `"founder_1_name" text not null default 'Founder 1', ` +
          `"founder_2_name" text not null default 'Founder 2', ` +
          `"founder_3_name" text not null default 'Founder 3', ` +
          `"default_currency" text not null default 'inr', `
      )
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "budget_funding_allocation" cascade;`)
    this.addSql(`drop table if exists "budget_funding_transaction" cascade;`)
    this.addSql(`drop table if exists "budget_funding_source" cascade;`)
    this.addSql(`drop table if exists "budget_expense" cascade;`)
    this.addSql(`drop table if exists "budget_monthly_budget" cascade;`)
    this.addSql(`drop table if exists "budget_cash_snapshot" cascade;`)
    this.addSql(`drop table if exists "budget_product_cost_sheet" cascade;`)
    this.addSql(`drop table if exists "budget_business_event" cascade;`)
    this.addSql(`drop table if exists "budget_expense_category" cascade;`)
    this.addSql(`drop table if exists "budget_settings" cascade;`)
  }
}
