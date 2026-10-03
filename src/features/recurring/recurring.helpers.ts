import { Category, RecurringRule, RecurrenceFrequency } from '@/types';
import { monthlyCostMinor } from '@/db/subscriptions';
import { categorySentence, parentNameOf } from '@/lib/categoryLabel';

export function frequencyNoun(freq: RecurrenceFrequency, count: number): string {
  const plural = count === 1 ? '' : 's';
  switch (freq) {
    case 'daily':
      return `day${plural}`;
    case 'weekly':
      return `week${plural}`;
    case 'monthly':
      return `month${plural}`;
    case 'yearly':
      return `year${plural}`;
  }
}

/** "Every month", "Every 2 weeks". */
export function cadenceLabel(frequency: RecurrenceFrequency, intervalCount: number): string {
  const every = intervalCount === 1 ? '' : `${intervalCount} `;
  return `Every ${every}${frequencyNoun(frequency, intervalCount)}`;
}

export function ruleCadenceLabel(rule: RecurringRule): string {
  return cadenceLabel(rule.frequency, rule.intervalCount);
}

const TYPE_RANK: Record<RecurringRule['type'], number> = { expense: 0, income: 1, transfer: 2 };

/** Running rules in the order the list shows: expenses, then income, then transfers; biggest month first within each. */
export function sortRunning(rules: RecurringRule[]): RecurringRule[] {
  return [...rules].sort(
    (a, b) =>
      TYPE_RANK[a.type] - TYPE_RANK[b.type] ||
      monthlyCostMinor(b) - monthlyCostMinor(a) ||
      a.nextRunDate.localeCompare(b.nextRunDate)
  );
}

export interface CostShare {
  key: string;
  name: string;
  minor: number;
  color: string;
}

const NO_CATEGORY_COLOR = '#C9C3AD';

/** Each running expense rule's slice of the monthly cost, biggest first. */
export function costShares(rules: RecurringRule[], categoriesById: Map<string, Category>): CostShare[] {
  return rules
    .filter((r) => r.active && r.type === 'expense')
    .map((r) => {
      const cat = r.categoryId ? categoriesById.get(r.categoryId) : undefined;
      return {
        key: r.id,
        name: cat ? categorySentence(cat.name, parentNameOf(cat.id, categoriesById)) : 'Other',
        minor: Math.round(monthlyCostMinor(r)),
        color: cat?.color ?? NO_CATEGORY_COLOR,
      };
    })
    .filter((s) => s.minor > 0)
    .sort((a, b) => b.minor - a.minor);
}

/** "Rent is 46% of it" — the biggest slice, said in words; nothing when there is only one. */
export function topShareLine(shares: CostShare[]): string | null {
  if (shares.length < 2) return null;
  const total = shares.reduce((sum, s) => sum + s.minor, 0);
  return `${shares[0].name} is ${Math.round((shares[0].minor / total) * 100)}% of it`;
}
