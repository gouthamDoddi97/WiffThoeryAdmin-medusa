import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260327000001 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "collection_tier_details" drop constraint if exists "collection_tier_details_category_id_unique";`);
    this.addSql(`create table if not exists "collection_tier_details" ("id" text not null, "category_id" text not null, "category_handle" text null, "tier_number" text null, "tagline" text null, "description" text null, "accent_color" text null, "next_tier_label" text null, "next_tier_href" text null, "next_tier_cta" text null, "image_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "collection_tier_details_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_collection_tier_details_category_id_unique" ON "collection_tier_details" ("category_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_collection_tier_details_deleted_at" ON "collection_tier_details" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "collection_tier_details" cascade;`);
  }

}
