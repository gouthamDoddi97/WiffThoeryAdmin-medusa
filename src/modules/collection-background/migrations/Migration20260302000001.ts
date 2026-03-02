import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260302000001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "collection_background" add column if not exists "mobile_image_url" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "collection_background" drop column if exists "mobile_image_url";`)
  }
}
