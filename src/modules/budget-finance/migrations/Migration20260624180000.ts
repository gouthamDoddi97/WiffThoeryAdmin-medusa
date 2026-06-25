import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260624180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "budget_founder_task" add column if not exists "recurrence" text not null default 'none';`
    )
    this.addSql(
      `alter table "budget_founder_task" add column if not exists "recurrence_interval_days" integer null;`
    )
    this.addSql(
      `alter table "budget_founder_task" add column if not exists "recurrence_end_date" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "budget_founder_task" drop column if exists "recurrence_end_date";`
    )
    this.addSql(
      `alter table "budget_founder_task" drop column if exists "recurrence_interval_days";`
    )
    this.addSql(`alter table "budget_founder_task" drop column if exists "recurrence";`)
  }
}
