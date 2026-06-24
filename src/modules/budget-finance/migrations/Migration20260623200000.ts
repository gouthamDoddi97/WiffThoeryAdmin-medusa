import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260623200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "budget_plan" add column if not exists "deferred_notes" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "budget_plan" drop column if exists "deferred_notes";`
    )
  }
}
