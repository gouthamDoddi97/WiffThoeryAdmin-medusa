import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260416130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "fragrance_set" add column if not exists "tags" text null;`)
    this.addSql(`alter table "fragrance_set" add column if not exists "usage_tips" text null;`)
    this.addSql(`alter table "fragrance_set" add column if not exists "ingredients" text null;`)
    this.addSql(`alter table "fragrance_set" add column if not exists "brand_info" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "fragrance_set" drop column if exists "tags";`)
    this.addSql(`alter table "fragrance_set" drop column if exists "usage_tips";`)
    this.addSql(`alter table "fragrance_set" drop column if exists "ingredients";`)
    this.addSql(`alter table "fragrance_set" drop column if exists "brand_info";`)
  }
}
