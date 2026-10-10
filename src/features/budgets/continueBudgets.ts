import { createBudget, type LapsedBudget, type BudgetInput } from '@/db/budgets';
import { errorMessage } from '@/lib/errorMessage';

/** Continue every eligible budget, retaining failures for an honest partial-success message. */
export async function continueBudgets(
  items: LapsedBudget[],
  periodMonth: string,
  create: (input: BudgetInput) => Promise<unknown> = createBudget
): Promise<string[]> {
  const failures: string[] = [];
  for (const item of items) {
    try {
      await create({
        categoryId: item.categoryId,
        limitAmountMinor: item.limitAmountMinor,
        rollover: item.rollover,
        periodMonth,
      });
    } catch (e) {
      failures.push(`${item.categoryName}: ${errorMessage(e)}`);
    }
  }
  return failures;
}
