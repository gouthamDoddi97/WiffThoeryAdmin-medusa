import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260405202038 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" add column if not exists "fg_preset" text null, add column if not exists "bg2_preset" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" drop column if exists "fg_preset", drop column if exists "bg2_preset";`);
  }

}
