import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260623160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "budget_plan_line_item" add column if not exists "product_id" text null;`
    )
    this.addSql(
      `alter table if exists "budget_plan_line_item" add column if not exists "variant_id" text null;`
    )
    this.addSql(
      `alter table if exists "budget_plan_line_item" add column if not exists "planned_fragrance_name" text null;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_plan_line_item_product" ON "budget_plan_line_item" ("product_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "budget_plan_line_item" drop column if exists "planned_fragrance_name";`
    )
    this.addSql(
      `alter table if exists "budget_plan_line_item" drop column if exists "variant_id";`
    )
    this.addSql(
      `alter table if exists "budget_plan_line_item" drop column if exists "product_id";`
    )
  }
}
