import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260623210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "budget_plan_revision" (
        "id" text not null,
        "plan_id" text not null,
        "revision_type" text not null,
        "item_label" text not null,
        "revised_item_label" text null,
        "category_id" text null,
        "original_quantity" numeric null,
        "revised_quantity" numeric null,
        "original_unit_price" numeric null,
        "revised_unit_price" numeric null,
        "original_total" numeric not null default 0,
        "revised_total" numeric not null default 0,
        "savings" numeric not null default 0,
        "reason" text null,
        "actor" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "budget_plan_revision_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_plan_revision_plan_id" ON "budget_plan_revision" ("plan_id");`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "budget_plan_revision" cascade;`)
  }
}
