import { getDb } from './client';
import { RecurringRule } from '@/types';
import { toLocalIsoDate, addDaysToIsoDate, addMonthsToIsoDate } from '@/lib/date';

/**
 * Subscriptions and bills on the Recurring screen: what running expense rules add up to, and entries that look
 * like they need a rule but lack one. Only ever suggests; "Make recurring" opens the ordinary rule form.
 */

/** How many times a rule runs in an average month (a month ≈ 30.44 days). */
const RUNS_PER_MONTH: Record<RecurringRule['frequency'], number> = {
  daily: 30.44,
  weekly: 30.44 / 7,
  monthly: 1,
  yearly: 1 / 12,
};

/** What one rule comes to in an average month, unrounded. */
export function monthlyCostMinor(rule: RecurringRule): number {
  return (rule.amountMinor * RUNS_PER_MONTH[rule.frequency]) / Math.max(1, rule.intervalCount);
}

export interface SubscriptionTotals {
  monthlyMinor: number;
  yearlyMinor: number;
  /** Running (active) expense rules counted. */
  count: number;
}

/**
 * Monthly and yearly cost of running expense rules (weekly/daily/yearly at their monthly share); paused rules,
 * income and transfers don't count. Rounded to whole minor units.
 */
export function subscriptionTotals(rules: RecurringRule[]): SubscriptionTotals {
  const running = rules.filter((r) => r.active && r.type === 'expense');
  const monthly = running.reduce((sum, r) => sum + monthlyCostMinor(r), 0);
  return { monthlyMinor: Math.round(monthly), yearlyMinor: Math.round(monthly * 12), count: running.length };
}

export interface SubscriptionSuggestion {
  /** Stable per category, so hiding one sticks: `sub-<categoryId>`. */
  key: string;
  categoryId: string;
  categoryName: string;
  /** The parent category's name, when the charge sits in a subcategory. */
  parentName?: string | null;
  icon: string;
  color: string;
  accountId: string;
  amountMinor: number;
  /** The latest matching entry's date — the rule's next run keeps its day of the month. */
  date: string;
  note: string;
  /** In Subscriptions but no rule; or the same charge seen once a month for a while. */
  source: 'subscriptions' | 'pattern';
  /** For a pattern: how many months in a row it's been seen. */
  months?: number;
}

interface EntryRow {
  category_id: string;
  category_name: string;
  parent_name: string | null;
  icon: string;
  color: string;
  account_id: string;
  amount_minor: number;
  date: string;
  note: string;
}

/** Categories that already have a running expense rule — never suggested again. */
async function categoriesWithRules(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ category_id: string }>(
    `SELECT DISTINCT category_id FROM recurring_rules
     WHERE active = 1 AND type = 'expense' AND category_id IS NOT NULL`
  );
  return new Set(rows.map((r) => r.category_id));
}

const suggestionFrom = (e: EntryRow, source: SubscriptionSuggestion['source'], months?: number) => ({
  key: `sub-${e.category_id}`,
  categoryId: e.category_id,
  categoryName: e.category_name,
  parentName: e.parent_name,
  icon: e.icon,
  color: e.color,
  accountId: e.account_id,
  amountMinor: e.amount_minor,
  date: e.date,
  note: e.note,
  source,
  ...(months ? { months } : {}),
});

/**
 * Entries in the last `days` days under a Subscriptions subcategory (or Subscriptions if it has none) with no
 * running rule; the newest entry of each stands in for it.
 */
export async function findUnscheduledSubscriptions(
  days = 60,
  today: string = toLocalIsoDate(new Date())
): Promise<SubscriptionSuggestion[]> {
  const db = await getDb();
  const since = addDaysToIsoDate(today, -days + 1);
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT t.category_id, c.name AS category_name, p.name AS parent_name, c.icon, c.color, t.account_id, t.amount_minor, t.date, t.note
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories p ON p.id = c.parent_id
     WHERE t.type = 'expense' AND t.loan_payment_id IS NULL AND t.loan_id IS NULL
       AND t.date >= ? AND t.date <= ?
       AND c.archived = 0 AND c.kind = 'expense'
       AND (LOWER(p.name) = 'subscriptions' AND p.parent_id IS NULL
            -- The parent itself only when it has no subcategories: with them,
            -- an entry on the parent is a one-off, not a service.
            OR LOWER(c.name) = 'subscriptions' AND c.parent_id IS NULL
               AND NOT EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = c.id AND k.archived = 0))
     ORDER BY t.date DESC, t.created_at DESC`,
    [since, today]
  );
  const ruled = await categoriesWithRules();
  const seen = new Set<string>();
  const out: SubscriptionSuggestion[] = [];
  for (const r of rows) {
    if (ruled.has(r.category_id) || seen.has(r.category_id)) continue;
    seen.add(r.category_id);
    out.push(suggestionFrom(r, 'subscriptions'));
  }
  return out;
}

/** How close a month's charge must be to the latest one to count as the same charge. */
const PATTERN_AMOUNT_TOLERANCE = 0.1;
const PATTERN_DAY_TOLERANCE = 5;
export const PATTERN_MIN_MONTHS = 3;

/**
 * Same charge monthly for 3+ months: same category, within 10% of the latest amount, near its day-of-month,
 * latest this/last month. Skips loan instalments and ruled categories; needs history (empty on new installs).
 */
export async function findMonthlyPatterns(
  today: string = toLocalIsoDate(new Date())
): Promise<SubscriptionSuggestion[]> {
  const db = await getDb();
  const since = addMonthsToIsoDate(today.slice(0, 7) + '-01', -6);
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT t.category_id, c.name AS category_name, p.name AS parent_name, c.icon, c.color, t.account_id, t.amount_minor, t.date, t.note
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories p ON p.id = c.parent_id
     WHERE t.type = 'expense' AND t.loan_payment_id IS NULL AND t.loan_id IS NULL
       AND t.date >= ? AND t.date <= ?
       AND c.archived = 0 AND c.is_system = 0
     ORDER BY t.date DESC, t.created_at DESC`,
    [since, today]
  );
  const ruled = await categoriesWithRules();
  const byCategory = new Map<string, EntryRow[]>();
  for (const r of rows) {
    if (ruled.has(r.category_id)) continue;
    const list = byCategory.get(r.category_id) ?? [];
    list.push(r);
    byCategory.set(r.category_id, list);
  }

  const thisMonth = today.slice(0, 7);
  const lastMonth = addMonthsToIsoDate(thisMonth + '-01', -1).slice(0, 7);
  const out: SubscriptionSuggestion[] = [];
  for (const entries of byCategory.values()) {
    const latest = entries[0];
    if (latest.date.slice(0, 7) !== thisMonth && latest.date.slice(0, 7) !== lastMonth) continue;
    const day = Number(latest.date.slice(8, 10));
    const matches = (e: EntryRow) =>
      Math.abs(e.amount_minor - latest.amount_minor) <= latest.amount_minor * PATTERN_AMOUNT_TOLERANCE &&
      Math.abs(Number(e.date.slice(8, 10)) - day) <= PATTERN_DAY_TOLERANCE;
    // Walk back month by month from the latest one while each has a match.
    let months = 0;
    let month = latest.date.slice(0, 7);
    while (entries.some((e) => e.date.startsWith(month) && matches(e))) {
      months += 1;
      month = addMonthsToIsoDate(month + '-01', -1).slice(0, 7);
    }
    if (months >= PATTERN_MIN_MONTHS) out.push(suggestionFrom(latest, 'pattern', months));
  }
  return out.sort((a, b) => b.amountMinor - a.amountMinor);
}

/**
 * Everything the Recurring screen suggests, minus the ones hidden with ✕:
 * Subscriptions entries first, then patterns not already listed.
 */
export async function getSubscriptionSuggestions(
  hidden: string[],
  today: string = toLocalIsoDate(new Date())
): Promise<SubscriptionSuggestion[]> {
  const [unscheduled, patterns] = await Promise.all([
    findUnscheduledSubscriptions(60, today),
    findMonthlyPatterns(today),
  ]);
  const hide = new Set(hidden);
  const listed = new Set(unscheduled.map((s) => s.key));
  return [...unscheduled, ...patterns.filter((p) => !listed.has(p.key))].filter((s) => !hide.has(s.key));
}
