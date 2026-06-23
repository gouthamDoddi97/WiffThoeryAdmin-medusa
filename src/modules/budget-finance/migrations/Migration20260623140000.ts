import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260623140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "budget_plan" (` +
        `"id" text not null, ` +
        `"title" text not null, ` +
        `"status" text not null default 'draft', ` +
        `"deadline" timestamptz null, ` +
        `"created_by" text not null, ` +
        `"notes" text null, ` +
        `"funding_source_id" text null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "budget_plan_pkey" primary key ("id")` +
        `);`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_plan_status" ON "budget_plan" ("status") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "budget_plan_line_item" (` +
        `"id" text not null, ` +
        `"plan_id" text not null, ` +
        `"label" text not null, ` +
        `"category_id" text not null, ` +
        `"quantity" numeric not null default 1, ` +
        `"unit_price" numeric not null default 0, ` +
        `"sort_order" integer not null default 0, ` +
        `"notes" text null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "budget_plan_line_item_pkey" primary key ("id")` +
        `);`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_plan_line_item_plan" ON "budget_plan_line_item" ("plan_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "budget_plan_activity" (` +
        `"id" text not null, ` +
        `"plan_id" text not null, ` +
        `"action" text not null, ` +
        `"actor" text not null, ` +
        `"details" jsonb null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "budget_plan_activity_pkey" primary key ("id")` +
        `);`
    )

    this.addSql(
      `create table if not exists "budget_founder_task" (` +
        `"id" text not null, ` +
        `"title" text not null, ` +
        `"description" text null, ` +
        `"assigned_to" text not null, ` +
        `"created_by" text not null, ` +
        `"due_date" timestamptz null, ` +
        `"status" text not null default 'todo', ` +
        `"priority" text not null default 'medium', ` +
        `"plan_id" text null, ` +
        `"is_milestone" boolean not null default false, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "budget_founder_task_pkey" primary key ("id")` +
        `);`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_founder_task_assignee" ON "budget_founder_task" ("assigned_to") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_founder_task_status" ON "budget_founder_task" ("status") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "budget_task_activity" (` +
        `"id" text not null, ` +
        `"task_id" text not null, ` +
        `"action" text not null, ` +
        `"actor" text not null, ` +
        `"details" jsonb null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "budget_task_activity_pkey" primary key ("id")` +
        `);`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_task_activity_task" ON "budget_task_activity" ("task_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "budget_expense" add column if not exists "plan_id" text null;`
    )
    this.addSql(
      `alter table if exists "budget_expense" add column if not exists "plan_line_item_id" text null;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_budget_expense_plan" ON "budget_expense" ("plan_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "budget_expense" drop column if exists "plan_line_item_id";`)
    this.addSql(`alter table if exists "budget_expense" drop column if exists "plan_id";`)
    this.addSql(`drop table if exists "budget_task_activity" cascade;`)
    this.addSql(`drop table if exists "budget_founder_task" cascade;`)
    this.addSql(`drop table if exists "budget_plan_activity" cascade;`)
    this.addSql(`drop table if exists "budget_plan_line_item" cascade;`)
    this.addSql(`drop table if exists "budget_plan" cascade;`)
  }
}
