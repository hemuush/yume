import { listAccounts, listCategories } from '@/db/ledger';
import { getRangeComparison, findTopGrowingCategory } from '@/db/reports';
import { getNextDueInstallment } from '@/db/loans';
import { listRecurringRules } from '@/db/recurring';
import { getAccentColor } from '@/db/settings';
import { CURRENT_PERIOD, periodRange, previousPeriodRange } from '@/lib/period';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct } from '@/lib/savingsRate';
import { dueDateLabel } from '@/lib/dueDate';
import { accountBadgeColor } from '@/lib/account';
import { suuLine, SuuLine } from '@/features/home/suuLine';

/**
 * Every widget's data source, one function per widget — each is the exact
 * same query/derivation the matching in-app screen already uses (Home's
 * ThisMonthHero, Home's Suu line, Home's Upcoming merge, Home's account
 * strip), just called directly instead of through a React component. These
 * run inside `widgetTaskHandler` (a headless JS context with no screen, no
 * hooks) as well as from the app's own foreground code when nudging a
 * widget to refresh immediately — see `notifyWidgets.ts`.
 */

/**
 * `refreshAllWidgets()` fires every placed widget's data function back to
 * back in the same tick, and several of them need the exact same query
 * (this month vs last month, the user's accent colour) — without this,
 * having both the This Month and Suu widgets placed doubles the "this
 * month vs last month" DB aggregation, and every widget that reads the
 * accent colour re-queries it separately. Coalescing calls that land within
 * a short window into one shared promise means one real burst of refreshes
 * still only queries each of these once; the window is short enough that a
 * genuinely later refresh (the 30-minute timer, or backgrounding again)
 * always sees fresh data rather than a stale cache.
 */
function coalesced<T>(fn: () => Promise<T>, windowMs = 2000): () => Promise<T> {
  let pending: { at: number; promise: Promise<T> } | null = null;
  return () => {
    const now = Date.now();
    if (pending && now - pending.at < windowMs) return pending.promise;
    const promise = fn();
    const entry = { at: now, promise };
    pending = entry;
    // A transient failure (a cold-start DB migration still running, a
    // one-off query hiccup) shouldn't get replayed as the *same* failure to
    // every other widget in this refresh burst — clear the cache the moment
    // it rejects so the next widget's call retries independently instead of
    // awaiting this same doomed promise.
    promise.catch(() => {
      if (pending === entry) pending = null;
    });
    return promise;
  };
}

const getAccentColorOnce = coalesced(getAccentColor);
const getMonthComparisonOnce = coalesced(() =>
  getRangeComparison(periodRange(CURRENT_PERIOD), previousPeriodRange(CURRENT_PERIOD), 'month')
);

export interface ThisMonthWidgetData {
  spentMinor: number;
  changePct: number | null;
  spentPct: number;
  keptPct: number;
  overspent: boolean;
  // Home's own ThisMonthHero swaps the bar's caption for "Add income to
  // track your saving" whenever there's no income yet this month — without
  // it, spentPct/keptPct default to 0/100, and the widget would otherwise
  // show real spending next to a fully "kept" bar with nothing to say why.
  hasIncome: boolean;
  accent: string;
}

export async function getThisMonthWidgetData(): Promise<ThisMonthWidgetData> {
  const [cmp, accent] = await Promise.all([getMonthComparisonOnce(), getAccentColorOnce()]);
  const incomeMinor = roundedMinor(cmp.current.incomeMinor);
  const spentMinor = roundedMinor(cmp.current.expenseMinor);
  const hasIncome = incomeMinor > 0;
  const overspent = hasIncome && spentMinor > incomeMinor;
  const spentPct = hasIncome ? Math.min(100, (spentMinor / incomeMinor) * 100) : 0;
  const keptPct = Math.max(0, 100 - spentPct);
  return { spentMinor, changePct: cmp.expenseChangePct, spentPct, keptPct, overspent, hasIncome, accent };
}

export interface SuuWidgetData {
  line: SuuLine;
}

export async function getSuuWidgetData(): Promise<SuuWidgetData> {
  const cmp = await getMonthComparisonOnce();
  const incomeMinor = roundedMinor(cmp.current.incomeMinor);
  const expenseMinor = roundedMinor(cmp.current.expenseMinor);
  const savingsPct = savingsRatePct(incomeMinor - expenseMinor, incomeMinor);
  const topGrowing = findTopGrowingCategory(cmp.current.categoryBreakdown, cmp.previous.categoryBreakdown);
  const line = suuLine(savingsPct, cmp.expenseChangePct ?? null, topGrowing?.name ?? null);
  return { line };
}

export interface NextDueWidgetData {
  title: string;
  subtitle: string;
  amountMinor: number;
  sign: '+' | '-';
  /** Where the click should deep-link to — Loans for an EMI, Recurring for a rule. */
  route: '/loans' | '/recurring';
  accent: string;
}

interface DueCandidate {
  title: string;
  subtitle: string;
  amountMinor: number;
  sign: '+' | '-';
  route: '/loans' | '/recurring';
  sortDate: string;
}

export async function getNextDueWidgetData(): Promise<NextDueWidgetData | null> {
  const [nextDue, rules, categories, accent] = await Promise.all([
    getNextDueInstallment(),
    listRecurringRules(),
    listCategories(),
    getAccentColorOnce(),
  ]);

  const candidates: DueCandidate[] = [];
  if (nextDue) {
    candidates.push({
      title: `${nextDue.counterparty} EMI`,
      subtitle: `Due ${dueDateLabel(nextDue.dueDate)}`,
      amountMinor: nextDue.emiAmountMinor,
      sign: '-',
      route: '/loans',
      sortDate: nextDue.dueDate,
    });
  }
  for (const rule of rules) {
    // A transfer rule has no single counterparty/category to lead with —
    // Home's own Upcoming list handles that case with two account names,
    // which needs more room than this widget's single title line has, so
    // it's left out here rather than shown half-labelled.
    if (!rule.active || rule.type === 'transfer') continue;
    const catName = categories.find((c) => c.id === rule.categoryId)?.name;
    candidates.push({
      title: rule.note || catName || 'Recurring',
      subtitle: `Due ${dueDateLabel(rule.nextRunDate)}`,
      amountMinor: rule.amountMinor,
      sign: rule.type === 'income' ? '+' : '-',
      route: '/recurring',
      sortDate: rule.nextRunDate,
    });
  }
  // Soonest date wins, same ordering Home's own merge uses.
  candidates.sort((a, b) => (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0));

  const top = candidates[0];
  if (!top) return null;
  return {
    title: top.title,
    subtitle: top.subtitle,
    amountMinor: top.amountMinor,
    sign: top.sign,
    route: top.route,
    accent,
  };
}

export interface AccountWidgetRow {
  name: string;
  balanceMinor: number;
  badgeColor: string;
}

export async function getAccountsWidgetData(): Promise<{ accounts: AccountWidgetRow[] }> {
  const [accounts, accent] = await Promise.all([listAccounts(), getAccentColorOnce()]);
  const rows: AccountWidgetRow[] = accounts.slice(0, 3).map((a) => ({
    name: a.name,
    balanceMinor: a.currentBalanceMinor,
    badgeColor: accountBadgeColor(a.type, accent),
  }));
  return { accounts: rows };
}
