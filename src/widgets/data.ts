import { listAccounts, listCategories } from '@/db/ledger';
import { getRangeComparison, findTopGrowingCategory } from '@/db/reports';
import { getNextDueInstallment } from '@/db/loans';
import { listRecurringRules } from '@/db/recurring';
import { getAccentColor } from '@/db/settings';
import { CURRENT_PERIOD, periodRange, previousPeriodRange } from '@/lib/period';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct } from '@/lib/savingsRate';
import { daysUntilIsoDate } from '@/lib/date';
import { suuLine, SuuLine } from '@/features/home/suuLine';
import { theme } from '@/constants/theme';

/**
 * Every widget's data source, one function per widget — each is the exact
 * same query/derivation the matching in-app screen already uses (Home's
 * ThisMonthHero, Home's Suu line, Home's Upcoming merge, Home's account
 * strip), just called directly instead of through a React component. These
 * run inside `widgetTaskHandler` (a headless JS context with no screen, no
 * hooks) as well as from the app's own foreground code when nudging a
 * widget to refresh immediately — see `notifyWidgets.ts`.
 */

export interface ThisMonthWidgetData {
  spentMinor: number;
  changePct: number | null;
  spentPct: number;
  keptPct: number;
  overspent: boolean;
  accent: string;
}

export async function getThisMonthWidgetData(): Promise<ThisMonthWidgetData> {
  const range = periodRange(CURRENT_PERIOD);
  const [cmp, accent] = await Promise.all([
    getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month'),
    getAccentColor(),
  ]);
  const incomeMinor = roundedMinor(cmp.current.incomeMinor);
  const spentMinor = roundedMinor(cmp.current.expenseMinor);
  const hasIncome = incomeMinor > 0;
  const overspent = hasIncome && spentMinor > incomeMinor;
  const spentPct = hasIncome ? Math.min(100, (spentMinor / incomeMinor) * 100) : 0;
  const keptPct = Math.max(0, 100 - spentPct);
  return { spentMinor, changePct: cmp.expenseChangePct, spentPct, keptPct, overspent, accent };
}

export interface SuuWidgetData {
  line: SuuLine;
}

export async function getSuuWidgetData(): Promise<SuuWidgetData> {
  const range = periodRange(CURRENT_PERIOD);
  const cmp = await getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month');
  const incomeMinor = roundedMinor(cmp.current.incomeMinor);
  const expenseMinor = roundedMinor(cmp.current.expenseMinor);
  const savingsPct = savingsRatePct(incomeMinor - expenseMinor, incomeMinor);
  const topGrowing = findTopGrowingCategory(cmp.current.categoryBreakdown, cmp.previous.categoryBreakdown);
  const line = suuLine(savingsPct, cmp.expenseChangePct ?? null, topGrowing?.name ?? null);
  return { line };
}

/** "today" / "in N days" — the exact copy Home's own Upcoming list uses. */
function dueDateLabel(dateStr: string): string {
  const days = daysUntilIsoDate(dateStr);
  if (days <= 0) return 'today';
  if (days <= 90) return `in ${days} days`;
  return `on ${dateStr}`;
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
    getAccentColor(),
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
  const [accounts, accent] = await Promise.all([listAccounts(), getAccentColor()]);
  const rows: AccountWidgetRow[] = accounts.slice(0, 3).map((a) => ({
    name: a.name,
    balanceMinor: a.currentBalanceMinor,
    // Same rule AccountChip uses in-app: colour by account *type*, not by
    // list position — a savings/credit account gets the warm tone, every
    // other account gets the user's own accent.
    badgeColor: a.type === 'savings' || a.type === 'credit_card' ? theme.colors.idCoralDeep : accent,
  }));
  return { accounts: rows };
}
