import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260416120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "fragrance_set" (` +
      `"id" text not null, ` +
      `"title" text not null, ` +
      `"description" text null, ` +
      `"price_amount" integer not null default 0, ` +
      `"currency_code" text not null default 'inr', ` +
      `"items" jsonb not null default '[]', ` +
      `"is_active" boolean not null default true, ` +
      `"badge" text null, ` +
      `"created_at" timestamptz not null default now(), ` +
      `"updated_at" timestamptz not null default now(), ` +
      `"deleted_at" timestamptz null, ` +
      `constraint "fragrance_set_pkey" primary key ("id")` +
      `);`
    )
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fragrance_set_is_active" ON "fragrance_set" ("is_active") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fragrance_set_deleted_at" ON "fragrance_set" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fragrance_set" cascade;`)
  }
}
