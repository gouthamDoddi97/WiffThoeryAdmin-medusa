import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260429140000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "fragrance_set" add column if not exists "set_image" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "fragrance_set" drop column if exists "set_image";`);
  }

}
