import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260328000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" add column if not exists "sillage" text null;`);
    this.addSql(`alter table if exists "perfume_details" add column if not exists "longevity" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" drop column if exists "sillage";`);
    this.addSql(`alter table if exists "perfume_details" drop column if exists "longevity";`);
  }

}
