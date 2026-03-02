import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260302000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "collection_background" ("id" text not null, "collection_id" text not null, "file_url" text not null, "badge" text null, "description" text null, "font_color_palette" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "collection_background_pkey" primary key ("id"));`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_collection_background_collection_id_unique" ON "collection_background" ("collection_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_collection_background_deleted_at" ON "collection_background" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "collection_background" cascade;`)
  }
}
