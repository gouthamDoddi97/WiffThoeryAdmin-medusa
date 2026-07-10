import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260708170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "fragrance_note" ("id" text not null, "name" text not null, "display_name" text not null, "image_url" text null, "perenual_species_id" integer null, "plant_query" text null, "image_source" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fragrance_note_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fragrance_note_name_unique" ON "fragrance_note" ("name") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fragrance_note_deleted_at" ON "fragrance_note" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fragrance_note" cascade;`)
  }
}
