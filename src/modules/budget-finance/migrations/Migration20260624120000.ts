import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260624120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "budget_settings" add column if not exists "founder_1_email" text null;`
    )
    this.addSql(
      `alter table "budget_settings" add column if not exists "founder_2_email" text null;`
    )
    this.addSql(
      `alter table "budget_settings" add column if not exists "founder_3_email" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "budget_settings" drop column if exists "founder_1_email";`)
    this.addSql(`alter table "budget_settings" drop column if exists "founder_2_email";`)
    this.addSql(`alter table "budget_settings" drop column if exists "founder_3_email";`)
  }
}
