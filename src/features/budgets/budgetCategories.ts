import type { Category } from '@/types';

/** Match the budget query's family privacy rule, including sensitive archived children. */
export function budgetCategories(categories: Category[], hideAmounts: boolean): Category[] {
  const privateFamilies = new Set(categories.filter((c) => c.isSensitive).map((c) => c.parentId ?? c.id));
  return categories.filter(
    (c) => !c.archived && c.kind === 'expense' && (!hideAmounts || !privateFamilies.has(c.parentId ?? c.id))
  );
}
