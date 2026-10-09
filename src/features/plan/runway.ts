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

const moves = (it: PlanDueItem) => it.kind === 'emi' || it.kind === 'bill' || it.kind === 'income';

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
    const outMinor = dayItems.filter((it) => it.kind !== 'income').reduce((s, it) => s + it.amountMinor, 0);
    const inMinor = dayItems.filter((it) => it.kind === 'income').reduce((s, it) => s + it.amountMinor, 0);
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
