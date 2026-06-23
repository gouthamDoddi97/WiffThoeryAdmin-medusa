import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260623180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "budget_plan_line_item" add column if not exists "shipping" numeric not null default 0;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "budget_plan_line_item" drop column if exists "shipping";`
    )
  }
}
