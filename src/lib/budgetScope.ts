/** A parent budget already includes its children's spending and limits in aggregate summaries. */
export function nonOverlappingBudgets<
  T extends {
    categoryId?: string;
    parentCategoryId?: string | null;
    budget?: { categoryId: string };
  },
>(budgets: readonly T[]): T[] {
  const categories = new Set(budgets.map((b) => b.budget?.categoryId ?? b.categoryId));
  return budgets.filter((b) => !b.parentCategoryId || !categories.has(b.parentCategoryId));
}
