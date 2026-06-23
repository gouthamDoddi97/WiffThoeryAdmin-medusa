import { MedusaService } from "@medusajs/framework/utils"
import ExpenseCategory from "./models/expense-category"
import Expense from "./models/expense"
import MonthlyBudget from "./models/monthly-budget"
import CashSnapshot from "./models/cash-snapshot"
import FundingSource from "./models/funding-source"
import FundingTransaction from "./models/funding-transaction"
import FundingAllocation from "./models/funding-allocation"
import ProductCostSheet from "./models/product-cost-sheet"
import BusinessEvent from "./models/business-event"
import BudgetSettings from "./models/settings"
import Plan from "./models/plan"
import PlanLineItem from "./models/plan-line-item"
import PlanActivity from "./models/plan-activity"
import FounderTask from "./models/founder-task"
import TaskActivity from "./models/task-activity"

class BudgetFinanceModuleService extends MedusaService({
  ExpenseCategory,
  Expense,
  MonthlyBudget,
  CashSnapshot,
  FundingSource,
  FundingTransaction,
  FundingAllocation,
  ProductCostSheet,
  BusinessEvent,
  BudgetSettings,
  Plan,
  PlanLineItem,
  PlanActivity,
  FounderTask,
  TaskActivity,
}) {}

export default BudgetFinanceModuleService
