import { Category, RecurringRule, RecurrenceFrequency } from '@/types';
import { monthlyCostMinor } from '@/db/subscriptions';
import { categorySentence, parentNameOf } from '@/lib/categoryLabel';
import { addDaysToIsoDate, dayOfIsoDate } from '@/lib/date';
import { advanceDate } from '@/lib/recurrence';

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

/** One run of a rule on Recurring's "when they land" line. */
export interface RunMark {
  key: string;
  date: string;
  amountMinor: number;
  /** Money in (income) or out (expenses and transfers). */
  incoming: boolean;
}

/** How far ahead the line looks, today included. */
export const RUN_WINDOW_DAYS = 30;

/**
 * Every run of these rules from today through the next `days - 1` days, each on its own day: a weekly bill
 * shows four or five times, a monthly one once. A run already due (catching up) counts on today. Stops at a
 * rule's end date.
 */
export function runMarks(
  rules: Pick<
    RecurringRule,
    'id' | 'type' | 'nextRunDate' | 'frequency' | 'intervalCount' | 'endDate' | 'amountMinor' | 'anchorDay'
  >[],
  today: string,
  days = RUN_WINDOW_DAYS
): RunMark[] {
  const until = addDaysToIsoDate(today, days - 1);
  const marks: RunMark[] = [];
  for (const r of rules) {
    // The rule's real day of the month (a 31st rule clamped to the 28th still lands on the 31st next).
    const anchor = r.anchorDay ?? dayOfIsoDate(r.nextRunDate);
    let date = r.nextRunDate;
    for (let n = 0; n < 400 && date <= until; n++) {
      if (r.endDate && date > r.endDate) break;
      marks.push({
        key: `${r.id}-${date}`,
        date: date < today ? today : date,
        amountMinor: r.amountMinor,
        incoming: r.type === 'income',
      });
      date = advanceDate(date, r.frequency, Math.max(1, r.intervalCount), anchor);
    }
  }
  return marks.sort((a, b) => a.date.localeCompare(b.date));
}
