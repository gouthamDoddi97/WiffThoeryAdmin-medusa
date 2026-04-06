import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260405000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "perfume_details" add column if not exists "animation_preset" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "perfume_details" drop column if exists "animation_preset";`
    )
  }
}