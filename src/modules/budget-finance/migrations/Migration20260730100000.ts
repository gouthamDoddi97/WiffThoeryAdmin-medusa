import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260730100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "budget_expense" add column if not exists "gst_amount" numeric not null default 0;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "budget_expense" drop column if exists "gst_amount";`)
  }
}
