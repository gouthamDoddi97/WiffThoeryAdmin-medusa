import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260406091024 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" add column if not exists "scene_image_1" text null, add column if not exists "scene_image_2" text null, add column if not exists "scene_image_3" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "perfume_details" drop column if exists "scene_image_1", drop column if exists "scene_image_2", drop column if exists "scene_image_3";`);
  }

}
