import type { CategoryBreakdownItem, PeriodComparison, PeriodSummary } from '@/db/reports';
import type { Category, TransactionType } from '@/types';

function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function sensitiveTotal(items: CategoryBreakdownItem[]): number {
  return items.reduce((sum, i) => (i.isSensitive ? sum + i.totalMinor : sum), 0);
}

/** One period as it reads with "hide savings & investment amounts" on — see privateComparison. */
export function privateSummary(s: PeriodSummary, hide: boolean): PeriodSummary {
  return hide ? withoutSensitiveCategories(s) : s;
}

function withoutSensitiveCategories(s: PeriodSummary): PeriodSummary {
  const expenseMinor = Math.max(0, s.expenseMinor - sensitiveTotal(s.categoryBreakdown));
  const incomeMinor = Math.max(0, s.incomeMinor - sensitiveTotal(s.incomeBreakdown));
  return {
    ...s,
    expenseMinor,
    incomeMinor,
    netMinor: incomeMinor - expenseMinor - s.savingsContributionMinor,
    categoryBreakdown: s.categoryBreakdown.filter((i) => !i.isSensitive),
    incomeBreakdown: s.incomeBreakdown.filter((i) => !i.isSensitive),
  };
}

/**
 * A period comparison as it reads with "hide savings & investment amounts"
 * on: the sensitive categories come out of both periods — their rows, and
 * the spending and income totals they were part of — so no total, share or
 * change figure can be subtracted back into what was saved or invested.
 * Returns the comparison itself when nothing is hidden.
 */
export function privateComparison(cmp: PeriodComparison, hide: boolean): PeriodComparison;
export function privateComparison(cmp: PeriodComparison | null, hide: boolean): PeriodComparison | null;
export function privateComparison(cmp: PeriodComparison | null, hide: boolean): PeriodComparison | null {
  if (!cmp || !hide) return cmp;
  const current = withoutSensitiveCategories(cmp.current);
  const previous = withoutSensitiveCategories(cmp.previous);
  return {
    ...cmp,
    current,
    previous,
    incomeChangePct: changePct(current.incomeMinor, previous.incomeMinor),
    expenseChangePct: changePct(current.expenseMinor, previous.expenseMinor),
  };
}

/**
 * Whether an entry (or a recurring rule) is part of savings or investments,
 * for "hide savings & investment amounts": spending or income in a sensitive
 * category, or a transfer into or out of a savings account.
 */
export function isSavingsEntry(
  tx: { type: TransactionType; accountId: string; toAccountId: string | null; categoryId: string | null },
  categoriesById: ReadonlyMap<string, Category>,
  savingsAccountIds: ReadonlySet<string>
): boolean {
  if (tx.type === 'transfer') {
    return savingsAccountIds.has(tx.accountId) || (!!tx.toAccountId && savingsAccountIds.has(tx.toAccountId));
  }
  return !!tx.categoryId && !!categoriesById.get(tx.categoryId)?.isSensitive;
}
