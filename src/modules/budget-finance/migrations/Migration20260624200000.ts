import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260624200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "budget_plan_line_item" add column if not exists "tax" numeric not null default 0;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "budget_plan_line_item" drop column if exists "tax";`)
  }
}
