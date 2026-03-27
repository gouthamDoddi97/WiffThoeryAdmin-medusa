import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260327130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "ugc_gallery_photo" ("id" text not null, "image_url" text not null, "alt_text" text null, "sort_order" integer not null default 0, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ugc_gallery_photo_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ugc_gallery_photo_sort_order" ON "ugc_gallery_photo" ("sort_order") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ugc_gallery_photo_deleted_at" ON "ugc_gallery_photo" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`insert into "ugc_gallery_photo" ("id", "image_url", "alt_text", "sort_order", "is_active") values ('ugc_photo_1', '/ugc/ugc-1.jpg', 'Community photo 1', 1, true) on conflict ("id") do nothing;`)
    this.addSql(`insert into "ugc_gallery_photo" ("id", "image_url", "alt_text", "sort_order", "is_active") values ('ugc_photo_2', '/ugc/ugc-2.jpg', 'Community photo 2', 2, true) on conflict ("id") do nothing;`)
    this.addSql(`insert into "ugc_gallery_photo" ("id", "image_url", "alt_text", "sort_order", "is_active") values ('ugc_photo_3', '/ugc/ugc-3.jpg', 'Community photo 3', 3, true) on conflict ("id") do nothing;`)
    this.addSql(`insert into "ugc_gallery_photo" ("id", "image_url", "alt_text", "sort_order", "is_active") values ('ugc_photo_4', '/ugc/ugc-4.jpg', 'Community photo 4', 4, true) on conflict ("id") do nothing;`)
    this.addSql(`insert into "ugc_gallery_photo" ("id", "image_url", "alt_text", "sort_order", "is_active") values ('ugc_photo_5', '/ugc/ugc-5.jpg', 'Community photo 5', 5, true) on conflict ("id") do nothing;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ugc_gallery_photo" cascade;`)
  }
}
