import { isFixedCategoryName } from './fixedCategory';

export interface AdviceCategory {
  name: string;
  /** Average spend a month, minor units. */
  monthlyMinor: number;
}

export interface SavingAdviceInput {
  /** What came in a month, on average (0 when unknown). */
  incomeMinor: number;
  /** What went out a month, on average. */
  spendMinor: number;
  categories: AdviceCategory[];
  openGoals: number;
}

export type AdviceTone = 'good' | 'warn' | 'bad' | 'info';

export interface SavingAdvice {
  key: string;
  tone: AdviceTone;
  title: string;
  body: string;
}

/** The yardstick: keep at least a fifth of what comes in. */
export const TARGET_SAVE_RATE = 0.2;
/** A choice category worth a look once it takes this share of income. */
const BIG_SHARE = 0.15;
/** The share of a choice category a person can usually trim without feeling it. */
const TRIM = 0.15;
const MAX_ADVICE = 4;

interface FlowMonth {
  incomeMinor: number;
  expenseMinor: number;
  /** False before the first entry was made. */
  recorded?: boolean;
}

/**
 * What a month usually brings in and costs: the last three finished months of a cash flow (oldest first, the month
 * still running last). Months before the first entry are left out, and so is the first month of use when a later one
 * exists: it is usually a part month and would pull both figures down. Ask for five months so that first month can be
 * told apart.
 */
export function usualCash(flow: FlowMonth[]): { incomeMinor: number; spendMinor: number } {
  const finished = flow.slice(0, -1);
  const used = (m: FlowMonth) => !!m.recorded && (m.incomeMinor > 0 || m.expenseMinor > 0);
  const firstOfUse = (i: number) => i > 0 && !finished[i - 1].recorded;
  const full = finished.filter((m, i) => used(m) && !firstOfUse(i));
  // A person with one finished month has only that part month to go on.
  const months = (full.length > 0 ? full : finished.filter(used)).slice(-3);
  const avg = (pick: (m: FlowMonth) => number) =>
    months.length ? Math.round(months.reduce((sum, m) => sum + pick(m), 0) / months.length) : 0;
  return { incomeMinor: avg((m) => m.incomeMinor), spendMinor: avg((m) => m.expenseMinor) };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Saving advice from a person’s own averages, most useful first, at most four. Plain arithmetic, nothing stored:
 * how much of income is kept, which choice category is biggest, how much of the month is already spoken for
 * (rent, EMIs, insurance, subscriptions) and what a subscription costs over a year. `money` formats minor units.
 */
export function savingAdvice(input: SavingAdviceInput, money: (minor: number) => string): SavingAdvice[] {
  const { incomeMinor, spendMinor, categories, openGoals } = input;
  const out: SavingAdvice[] = [];
  if (spendMinor <= 0 && incomeMinor <= 0) return out;

  const base = incomeMinor > 0 ? incomeMinor : spendMinor;
  const flexible = categories.filter((c) => c.monthlyMinor > 0 && !isFixedCategoryName(c.name));
  const fixedMinor = categories
    .filter((c) => isFixedCategoryName(c.name))
    .reduce((sum, c) => sum + c.monthlyMinor, 0);

  if (incomeMinor > 0) {
    const kept = incomeMinor - spendMinor;
    const rate = kept / incomeMinor;
    const targetMinor = Math.round(incomeMinor * TARGET_SAVE_RATE);
    if (kept < 0) {
      out.push({
        key: 'rate',
        tone: 'bad',
        title: 'You spend more than you earn',
        body: `On average ${money(-kept)} more goes out than comes in each month. Stop the gap first: even a small saving only counts once spending is under income.`,
      });
    } else if (rate < TARGET_SAVE_RATE) {
      out.push({
        key: 'rate',
        tone: 'warn',
        title: `You keep ${pct(rate)} of what you earn`,
        body: `A common goal is 20%, about ${money(targetMinor)} a month for you. Moving ${money(targetMinor - kept)} to savings the day income arrives works better than saving what is left.`,
      });
    } else {
      out.push({
        key: 'rate',
        tone: 'good',
        title: `You keep ${pct(rate)} of what you earn`,
        body: `That is above the 20% goal. Give the extra a job: a goal with a date, or a prepayment on your costliest loan.`,
      });
    }
  }

  const top = [...flexible].sort((a, b) => b.monthlyMinor - a.monthlyMinor)[0];
  if (top && top.monthlyMinor >= base * BIG_SHARE) {
    const month = Math.round(top.monthlyMinor * TRIM);
    out.push({
      key: 'top',
      tone: 'info',
      title: `${top.name} is your biggest choice`,
      body: `It takes ${pct(top.monthlyMinor / base)} of ${incomeMinor > 0 ? 'your income' : 'your spending'}. Trimming it by 15% frees ${money(month)} a month, ${money(month * 12)} a year, and rarely feels like a sacrifice.`,
    });
  }

  if (incomeMinor > 0 && fixedMinor / incomeMinor >= 0.5) {
    out.push({
      key: 'fixed',
      tone: 'warn',
      title: `${pct(fixedMinor / incomeMinor)} is already spoken for`,
      body: `Rent, EMIs, insurance and subscriptions take ${money(fixedMinor)} a month, so little is left to cut. Ask whether a loan can be prepaid or its rate lowered: that frees money every month.`,
    });
  }

  const subs = categories.find((c) => c.name === 'Subscriptions');
  if (subs && subs.monthlyMinor > 0)
    out.push({
      key: 'subs',
      tone: 'info',
      title: `Subscriptions: ${money(subs.monthlyMinor * 12)} a year`,
      body: `That is ${money(subs.monthlyMinor)} a month. List each one and cancel any you did not use in the last month; you can always join again.`,
    });

  if (openGoals === 0)
    out.push({
      key: 'goal',
      tone: 'info',
      title: 'Give your savings a name',
      body: 'Money with a purpose and a date gets saved more often. Start one small goal, such as one month of spending as a cushion.',
    });

  return out.slice(0, MAX_ADVICE);
}
