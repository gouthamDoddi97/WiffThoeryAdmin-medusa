import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260327000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "collection_tier_details" add column if not exists "image_url" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "collection_tier_details" drop column if exists "image_url";`)
  }
}