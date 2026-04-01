import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "product_review" (` +
      `"id" text not null, ` +
      `"product_id" text not null, ` +
      `"author_name" text not null, ` +
      `"author_email" text null, ` +
      `"rating" integer not null default 5, ` +
      `"title" text null, ` +
      `"body" text not null, ` +
      `"is_approved" boolean not null default false, ` +
      `"created_at" timestamptz not null default now(), ` +
      `"updated_at" timestamptz not null default now(), ` +
      `"deleted_at" timestamptz null, ` +
      `constraint "product_review_pkey" primary key ("id")` +
      `);`
    )
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_review_product_id" ON "product_review" ("product_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_review_is_approved" ON "product_review" ("is_approved") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_review_deleted_at" ON "product_review" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_review" cascade;`)
  }
}
