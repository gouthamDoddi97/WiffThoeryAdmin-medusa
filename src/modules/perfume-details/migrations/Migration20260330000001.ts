import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260330000001 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" add column if not exists "occasions" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" drop column if exists "occasions";`);
  }

}
