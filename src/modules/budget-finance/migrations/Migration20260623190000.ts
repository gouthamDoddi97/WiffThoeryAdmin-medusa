import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260623190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "budget_plan" add column if not exists "invoice_url" text null;`
    )
    this.addSql(
      `alter table if exists "budget_founder_task" add column if not exists "attachment_url" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "budget_founder_task" drop column if exists "attachment_url";`
    )
    this.addSql(
      `alter table if exists "budget_plan" drop column if exists "invoice_url";`
    )
  }
}
