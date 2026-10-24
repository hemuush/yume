import { addDaysToIsoDate } from '@/lib/date';
import { Account } from '@/types';
import type { PlanDueItem } from './planOverview';

/**
 * Plan's runway: what your spending accounts hold today, stepped down by each EMI and bill and up by each
 * income over the next days, so the hero can say whether they cover what's due and where the balance bottoms
 * out. Pure (today and the starting balance are inputs). Transfers between your own accounts are left out.
 */

/** Where day-to-day bills come out of: bank, cash and wallets in the default currency, not archived. */
export function isRunwayAccount(a: Account, currency: string): boolean {
  return (
    !a.archived &&
    !a.investment &&
    a.currency === currency &&
    (a.type === 'bank' || a.type === 'cash' || a.type === 'wallet')
  );
}

/** What those accounts hold together: where the runway starts. */
export function runwayStartMinor(accounts: Account[], currency: string): number {
  return accounts
    .filter((a) => isRunwayAccount(a, currency))
    .reduce((sum, a) => sum + a.currentBalanceMinor, 0);
}

/**
 * Which way a scheduled transfer moves the spending balance, so the runway and the Upcoming lists agree:
 * `out` when it leaves bank, cash and wallets (a SIP, a move to savings), `in` when it comes back into them (a
 * withdrawal, a sweep from savings), null when it changes nothing you can spend (between two spending
 * accounts, between two savings/investments) or touches a credit card, whose own bill is already counted.
 */
export function transferFlow(
  rule: { accountId: string; toAccountId?: string | null },
  accounts: Map<string, Account>,
  currency: string
): 'out' | 'in' | null {
  const from = accounts.get(rule.accountId);
  const to = rule.toAccountId ? accounts.get(rule.toAccountId) : undefined;
  if (!from || !to || from.type === 'credit_card' || to.type === 'credit_card') return null;
  const fromSpend = isRunwayAccount(from, currency);
  const toSpend = isRunwayAccount(to, currency);
  return fromSpend && !toSpend ? 'out' : !fromSpend && toSpend ? 'in' : null;
}

export interface RunwayDay {
  date: string;
  /** The balance going into the day, and after its items. */
  beforeMinor: number;
  afterMinor: number;
  /** What moves money that day (EMIs, bills, income); anything overdue counts on the first day. */
  items: PlanDueItem[];
  outMinor: number;
  inMinor: number;
}

export interface Runway {
  startMinor: number;
  days: RunwayDay[];
  endMinor: number;
  lowMinor: number;
  lowDate: string;
  /** The first day the balance goes below zero, and by how much — null when the accounts cover it all. */
  short: { date: string; minor: number } | null;
  /** Income landing in the window. */
  inMinor: number;
}

const moves = (it: PlanDueItem) =>
  it.kind === 'emi' || it.kind === 'bill' || it.kind === 'income' || it.transfer !== undefined;
/** Money coming in: income, or a transfer back into spending accounts. */
const isIn = (it: PlanDueItem) => it.kind === 'income' || it.transfer?.flow === 'in';

export function buildRunway(startMinor: number, items: PlanDueItem[], today: string, count: number): Runway {
  let balance = startMinor;
  let lowMinor = startMinor;
  let lowDate = today;
  let short: Runway['short'] = null;
  let inTotal = 0;
  const days: RunwayDay[] = [];
  for (let i = 0; i < count; i++) {
    const date = addDaysToIsoDate(today, i);
    const dayItems = items.filter((it) => moves(it) && (i === 0 ? it.dueDate <= date : it.dueDate === date));
    const outMinor = dayItems.filter((it) => !isIn(it)).reduce((s, it) => s + it.amountMinor, 0);
    const inMinor = dayItems.filter(isIn).reduce((s, it) => s + it.amountMinor, 0);
    const beforeMinor = balance;
    balance = balance - outMinor + inMinor;
    inTotal += inMinor;
    days.push({ date, beforeMinor, afterMinor: balance, items: dayItems, outMinor, inMinor });
    if (balance < lowMinor) {
      lowMinor = balance;
      lowDate = date;
    }
    if (balance < 0 && !short) short = { date, minor: -balance };
  }
  return { startMinor, days, endMinor: balance, lowMinor, lowDate, short, inMinor: inTotal };
}
