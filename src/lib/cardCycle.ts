import { addDaysToIsoDate, parseLocalIsoDate, toLocalIsoDate } from './date';

/**
 * A credit card's billing cycle (the Missing pieces sign-off), as pure date
 * maths: the statement day and the bill due day are days of the month the
 * card's own statement names. A day past a short month's end (29–31) falls
 * on that month's last day.
 */

/** The day `day` in the month of `year`/`month0`, clamped to that month's last day. */
function dayInMonth(year: number, month0: number, day: number): string {
  const last = new Date(year, month0 + 1, 0).getDate();
  return toLocalIsoDate(new Date(year, month0, Math.min(day, last)));
}

/** The most recent statement date on or before `today`. */
export function lastStatementDate(statementDay: number, today: string): string {
  const t = parseLocalIsoDate(today);
  const thisMonth = dayInMonth(t.getFullYear(), t.getMonth(), statementDay);
  return thisMonth <= today ? thisMonth : dayInMonth(t.getFullYear(), t.getMonth() - 1, statementDay);
}

/** The statement date after `statement` — the end of the cycle it opens. */
export function nextStatementDate(statementDay: number, statement: string): string {
  const s = parseLocalIsoDate(statement);
  return dayInMonth(s.getFullYear(), s.getMonth() + 1, statementDay);
}

/** When the bill for the statement on `statement` is due: the first due day after it. */
export function dueDateFor(dueDay: number, statement: string): string {
  const s = parseLocalIsoDate(statement);
  const sameMonth = dayInMonth(s.getFullYear(), s.getMonth(), dueDay);
  return sameMonth > statement ? sameMonth : dayInMonth(s.getFullYear(), s.getMonth() + 1, dueDay);
}

export interface CardCycleInput {
  statementDay: number;
  dueDay: number;
  today: string;
  /** What the card owed at the end of the last statement day (positive = owed). */
  owedAtStatementMinor: number;
  /** Payments into the card since the statement (transfers in, refunds, anything that lowers what's owed). */
  paidSinceMinor: number;
  /** Spending on the card since the statement, up to today. */
  spentThisCycleMinor: number;
}

export interface CardCycle {
  /** The first and last day of the cycle in progress. */
  cycleStart: string;
  cycleEnd: string;
  spentThisCycleMinor: number;
  statementDate: string;
  statementMinor: number;
  paidSinceMinor: number;
  dueDate: string;
  /** What's still owed on the last statement; 0 once it's paid off. */
  leftToPayMinor: number;
  /** Days until it's due: 0 on the day, negative once it's late. */
  daysUntilDue: number;
}

/** The dates a cycle needs, before any money is looked up. */
export function cycleDates(statementDay: number, dueDay: number, today: string) {
  const statementDate = lastStatementDate(statementDay, today);
  return {
    statementDate,
    cycleStart: addDaysToIsoDate(statementDate, 1),
    cycleEnd: nextStatementDate(statementDay, statementDate),
    dueDate: dueDateFor(dueDay, statementDate),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildCardCycle(input: CardCycleInput): CardCycle {
  const d = cycleDates(input.statementDay, input.dueDay, input.today);
  const statementMinor = Math.max(0, input.owedAtStatementMinor);
  return {
    ...d,
    spentThisCycleMinor: input.spentThisCycleMinor,
    statementMinor,
    paidSinceMinor: input.paidSinceMinor,
    leftToPayMinor: Math.max(0, statementMinor - input.paidSinceMinor),
    daysUntilDue: Math.round(
      (parseLocalIsoDate(d.dueDate).getTime() - parseLocalIsoDate(input.today).getTime()) / DAY_MS
    ),
  };
}

/** Whether a day of the month is a valid statement or due day. */
export function isCycleDay(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

/**
 * Reads the two day fields from a form: both empty (no bill tracking), or
 * both whole days from 1 to 31. Anything else comes back as the message to
 * show under the form.
 */
export function parseCycleDays(
  statementText: string,
  dueText: string
): { statementDay: number | null; dueDay: number | null } | { error: string } {
  const s = statementText.trim();
  const d = dueText.trim();
  if (!s && !d) return { statementDay: null, dueDay: null };
  if (!s || !d) return { error: 'Enter both the statement day and the bill due day, or leave both empty' };
  const statementDay = Number(s);
  const dueDay = Number(d);
  if (!isCycleDay(statementDay) || !isCycleDay(dueDay)) {
    return { error: 'Statement and due days are days of the month, from 1 to 31' };
  }
  return { statementDay, dueDay };
}
