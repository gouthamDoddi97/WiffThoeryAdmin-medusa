import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260224092733 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" drop constraint if exists "perfume_details_product_id_unique";`);
    this.addSql(`create table if not exists "perfume_details" ("id" text not null, "product_id" text not null, "certifications" text null, "top_notes" text null, "middle_notes" text null, "base_notes" text null, "scent_story" text null, "usage_tips" text null, "ingredients" text null, "brand_info" text null, "manufacturer_info" text null, "license_no" text null, "expiry_info" text null, "customer_care" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "perfume_details_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_perfume_details_product_id_unique" ON "perfume_details" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_perfume_details_deleted_at" ON "perfume_details" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "perfume_details" cascade;`);
  }

}
