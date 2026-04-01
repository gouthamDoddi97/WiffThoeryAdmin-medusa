import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401095938 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" add column if not exists "occasions" text null, add column if not exists "scent_weight" integer null, add column if not exists "caption" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" drop column if exists "occasions", drop column if exists "scent_weight", drop column if exists "caption";`);
  }

}
