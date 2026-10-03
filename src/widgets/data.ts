import { categorySentence, parentNameOf } from '@/lib/categoryLabel';
import { listAccounts, listCategories, listMostUsedExpenseCategories } from '@/db/ledger';
import { getRangeComparison, findTopGrowingCategory, getMonthPaceInputs } from '@/db/reports';
import { getNextDueInstallment } from '@/db/loans';
import { listRecurringRules } from '@/db/recurring';
import { getAccentColor, getThemeId, getHideSensitiveAmounts } from '@/db/settings';
import { formatMaskableMoney, formatMoney } from '@/lib/money';
import { resolveActiveTheme } from '@/theme/themes';
import { CURRENT_PERIOD, periodRange, previousPeriodRange } from '@/lib/period';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct } from '@/lib/savingsRate';
import { dueDateLabel } from '@/lib/dueDate';
import { accountIcon } from '@/lib/account';
import { toLocalIsoDate, parseLocalIsoDate } from '@/lib/date';
import { monthPace } from '@/lib/pace';
import { suuLine, SuuLine } from '@/features/home/suuLine';
import { heroSlices, withoutSavings, HeroSlices } from '@/features/home/heroSlices';
import type { Account } from '@/types';
import { widgetColor } from './widgetTheme';

/**
 * Every widget's data source, one function per widget — each is the exact
 * same query/derivation the matching in-app screen already uses (Home's
 * month card, Home's Suu line, Home's Upcoming merge, Home's account
 * cards), just called directly instead of through a React component. These
 * run inside `widgetTaskHandler` (a headless JS context with no screen, no
 * hooks) as well as from the app's own foreground code when nudging a
 * widget to refresh immediately — see `notifyWidgets.ts`.
 */

/**
 * `refreshAllWidgets()` fires every placed widget's data function back to
 * back in the same tick, and several of them need the exact same query
 * (this month vs last month, the active theme pack) — without this, having
 * both the This Month and Suu widgets placed doubles the "this month vs
 * last month" DB aggregation, and every widget that reads the theme
 * re-queries it separately. Coalescing calls that land within a short
 * window into one shared promise means one real burst of refreshes still
 * only queries each of these once; the window is short enough that a
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

const getActiveThemeOnce = coalesced(() => resolveActiveTheme(getThemeId, getAccentColor));
const getMonthComparisonOnce = coalesced(() =>
  getRangeComparison(periodRange(CURRENT_PERIOD), previousPeriodRange(CURRENT_PERIOD), 'month')
);

export interface ThisMonthWidgetData {
  /** "September". */
  monthLabel: string;
  /** Days after today left in the month; 0 on its last day. */
  daysLeft: number;
  spentMinor: number;
  /** Moved to savings; 0 and unused while `hideSavings` (the figure never reaches the widget). */
  savedMinor: number;
  /** "Hide savings & investment amounts" is on: no Saved tile, no savings arc. */
  hideSavings: boolean;
  /** Income − spent − moved to savings; negative when more went out than came in. */
  freeMinor: number;
  slices: HeroSlices;
  /** Home's "On pace for about … by …" line, from the 5th on. */
  pace: { projectedMinor: number; byLabel: string } | null;
  primary: string;
  secondary: string;
}

/** Home's month card, for today's month: the same figures ThisMonthHero shows. */
export async function getThisMonthWidgetData(now: Date = new Date()): Promise<ThisMonthWidgetData> {
  const today = toLocalIsoDate(now);
  const [cmp, theme, paceIn, hideSavings] = await Promise.all([
    getMonthComparisonOnce(),
    getActiveThemeOnce(),
    getMonthPaceInputs(today),
    getHideSensitiveAmounts(),
  ]);
  const incomeMinor = roundedMinor(cmp.current.incomeMinor);
  const spentMinor = roundedMinor(cmp.current.expenseMinor);
  const savedMinor = roundedMinor(cmp.current.savingsContributionMinor ?? 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const paceMinor = monthPace({ spentMinor: cmp.current.expenseMinor, ...paceIn, today });
  return {
    monthLabel: now.toLocaleDateString(undefined, { month: 'long' }),
    daysLeft: monthEnd.getDate() - now.getDate(),
    spentMinor,
    savedMinor: hideSavings ? 0 : savedMinor,
    hideSavings,
    freeMinor: incomeMinor - spentMinor - savedMinor,
    slices: hideSavings
      ? withoutSavings(heroSlices(incomeMinor, spentMinor, savedMinor))
      : heroSlices(incomeMinor, spentMinor, savedMinor),
    pace:
      paceMinor != null
        ? {
            projectedMinor: paceMinor,
            byLabel: monthEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          }
        : null,
    primary: theme.primary,
    secondary: theme.secondary,
  };
}

export interface QuickAddCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface QuickAddWidgetData {
  primary: string;
  categories: QuickAddCategory[];
}

/** How far back Quick Add looks for the categories you use most. */
const QUICK_ADD_LOOKBACK_DAYS = 90;
export const QUICK_ADD_CATEGORY_COUNT = 4;

/** Quick Add's shortcuts: your four most-used expense categories of the last 90 days. */
export async function getQuickAddWidgetData(now: Date = new Date()): Promise<QuickAddWidgetData> {
  const since = new Date(now);
  since.setDate(since.getDate() - QUICK_ADD_LOOKBACK_DAYS);
  const [cats, theme] = await Promise.all([
    listMostUsedExpenseCategories(QUICK_ADD_CATEGORY_COUNT, toLocalIsoDate(since)),
    getActiveThemeOnce(),
  ]);
  return {
    primary: theme.primary,
    categories: cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color || theme.primary })),
  };
}

export interface SuuWidgetData {
  line: SuuLine;
  /** The active pack's mascot-dot colour — Suu's one dot follows the theme, as in the app. */
  dot: string;
  /** The pack's second colour, for the footer under the line. */
  secondary: string;
}

export async function getSuuWidgetData(): Promise<SuuWidgetData> {
  const [cmp, theme, hideSavings] = await Promise.all([
    getMonthComparisonOnce(),
    getActiveThemeOnce(),
    getHideSensitiveAmounts(),
  ]);
  const incomeMinor = roundedMinor(cmp.current.incomeMinor);
  const expenseMinor = roundedMinor(cmp.current.expenseMinor);
  const savingsPct = savingsRatePct(incomeMinor - expenseMinor, incomeMinor);
  const topGrowing = findTopGrowingCategory(cmp.current.categoryBreakdown, cmp.previous.categoryBreakdown);
  const line = suuLine(
    savingsPct,
    cmp.expenseChangePct ?? null,
    topGrowing?.name ?? null,
    undefined,
    hideSavings
  );
  return { line, dot: theme.dot, secondary: theme.secondary };
}

export interface NextDueWidgetData {
  title: string;
  subtitle: string;
  amountMinor: number;
  sign: '+' | '-';
  /** Where the click should deep-link to — Loans for an EMI, Recurring for a rule. */
  route: '/loans' | '/recurring';
  /** The due date, for the date tile: "01" over "OCT". */
  dateIso: string;
  /** The date tile's colour: the pack's own for an EMI, the category's for a rule. */
  tint: string;
}

interface DueCandidate extends NextDueWidgetData {
  sortDate: string;
}

export async function getNextDueWidgetData(): Promise<NextDueWidgetData | null> {
  const [nextDue, rules, categories, theme] = await Promise.all([
    getNextDueInstallment(),
    listRecurringRules(),
    listCategories(),
    getActiveThemeOnce(),
  ]);

  const candidates: DueCandidate[] = [];
  if (nextDue) {
    candidates.push({
      title: `${nextDue.counterparty} EMI`,
      subtitle: dueDateLabel(nextDue.dueDate),
      amountMinor: nextDue.emiAmountMinor,
      sign: '-',
      route: '/loans',
      dateIso: nextDue.dueDate,
      sortDate: nextDue.dueDate,
      tint: theme.primary,
    });
  }
  for (const rule of rules) {
    // A transfer rule has no single counterparty/category to lead with —
    // Home's own Upcoming list handles that case with two account names,
    // which needs more room than this widget's single title line has, so
    // it's left out here rather than shown half-labelled.
    if (!rule.active || rule.type === 'transfer') continue;
    const cat = categories.find((c) => c.id === rule.categoryId);
    candidates.push({
      title:
        rule.note ||
        (cat
          ? categorySentence(cat.name, parentNameOf(cat.id, new Map(categories.map((c) => [c.id, c]))))
          : 'Recurring'),
      subtitle: dueDateLabel(rule.nextRunDate),
      amountMinor: rule.amountMinor,
      sign: rule.type === 'income' ? '+' : '-',
      route: '/recurring',
      dateIso: rule.nextRunDate,
      sortDate: rule.nextRunDate,
      tint: cat?.color ?? theme.primary,
    });
  }
  // Soonest date wins, same ordering Home's own merge uses.
  candidates.sort((a, b) => (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0));

  const top = candidates[0];
  if (!top) return null;
  const { sortDate: _sortDate, ...item } = top;
  return item;
}

/** "01" and "OCT" for a date tile, like Home's Upcoming rows. */
export function dateTileParts(iso: string): { day: string; month: string } {
  const d = parseLocalIsoDate(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString(undefined, { month: 'short' }).slice(0, 3).toUpperCase(),
  };
}

export interface AccountWidgetRow {
  name: string;
  /** "Credit card", "Bank" — the account's type, spelled out. */
  typeLabel: string;
  icon: string;
  /** The colour family, the same as Home's account cards. */
  hue: string;
  /** Already formatted — in the account's own currency, and masked exactly when the in-app balance would be. */
  balanceText: string;
  negative: boolean;
}

export interface AccountsWidgetData {
  accounts: AccountWidgetRow[];
  /** Every account added up — only when they share one currency and nothing is hidden. */
  totalText: string | null;
}

/** The colour family an account is tinted in, by type — the same as Home's account cards. */
export function accountWidgetHue(type: Account['type'], primary: string, secondary: string): string {
  switch (type) {
    case 'cash':
      return widgetColor.flatLime;
    case 'wallet':
      return secondary;
    case 'credit_card':
      return widgetColor.idGoldDeep;
    case 'savings':
      return widgetColor.idCoralDeep;
    default:
      return primary;
  }
}

export async function getAccountsWidgetData(): Promise<AccountsWidgetData> {
  const [accounts, theme, hideAmounts] = await Promise.all([
    listAccounts(),
    getActiveThemeOnce(),
    getHideSensitiveAmounts(),
  ]);
  const hidden = (a: Account) => hideAmounts && a.type === 'savings';
  const rows: AccountWidgetRow[] = accounts.slice(0, 3).map((a) => ({
    name: a.name,
    typeLabel: a.type.charAt(0).toUpperCase() + a.type.slice(1).replace('_', ' '),
    icon: accountIcon(a.type),
    hue: accountWidgetHue(a.type, theme.primary, theme.secondary),
    // Same rule as Home's account cards: the account's own currency, and a
    // savings balance masked when "hide savings & investment amounts" is on.
    balanceText: formatMaskableMoney(a.currentBalanceMinor, { currency: a.currency, masked: hidden(a) }),
    negative: a.currentBalanceMinor < 0,
  }));
  const currencies = new Set(accounts.map((a) => a.currency));
  const totalText =
    accounts.length > 1 && currencies.size === 1 && !accounts.some(hidden)
      ? formatMoney(
          accounts.reduce((sum, a) => sum + a.currentBalanceMinor, 0),
          accounts[0].currency
        )
      : null;
  return { accounts: rows, totalText };
}
