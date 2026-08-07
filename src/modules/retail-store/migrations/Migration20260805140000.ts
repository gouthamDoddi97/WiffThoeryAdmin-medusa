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

export class Migration20260805140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      tableSql(
        "retail_store",
        `"id" text not null, ` +
          `"name" text not null, ` +
          `"location" text not null, ` +
          `"stock_location_id" text not null, ` +
          `"is_active" boolean not null default true, ` +
          `"notes" text null, `
      )
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_retail_store_stock_location_id" ON "retail_store" ("stock_location_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      tableSql(
        "store_stock_transfer",
        `"id" text not null, ` +
          `"retail_store_id" text not null, ` +
          `"from_stock_location_id" text not null, ` +
          `"variant_id" text not null, ` +
          `"quantity" integer not null, ` +
          `"notes" text null, `
      )
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_store_stock_transfer_store_id" ON "store_stock_transfer" ("retail_store_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "store_stock_transfer" cascade;`)
    this.addSql(`drop table if exists "retail_store" cascade;`)
  }
}
