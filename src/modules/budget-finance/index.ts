import { Module } from "@medusajs/framework/utils"
import BudgetFinanceModuleService from "./service"

export const BUDGET_FINANCE_MODULE = "budgetFinance"

export default Module(BUDGET_FINANCE_MODULE, {
  service: BudgetFinanceModuleService,
})
