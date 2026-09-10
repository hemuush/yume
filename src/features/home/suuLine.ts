import { savingsRateLabel } from '@/lib/savingsRate';

export interface SuuLine {
  text: string;
  pose: 'default' | 'sleepy';
}

/**
 * The one encouraging line Suu says in the Home hero. Derived entirely from
 * this period's real figures — never a placeholder — mirroring the rule the
 * old "Suu says" InsightCard followed.
 *
 * A spending-is-up nudge is left to `SpendingAlertCard` (which can name the
 * category that moved) — Suu only turns cautionary when the month actually
 * ran a deficit, so the two never say the same thing at once.
 *
 * @param savingsPct  raw savings rate (net ÷ income × 100); may be negative
 * @param expenseChangePct  spend vs the previous period, or null when there's
 *                          no comparison yet (a fresh install / empty month)
 */
export function suuLine(savingsPct: number, expenseChangePct: number | null): SuuLine {
  if (expenseChangePct == null) {
    return { text: "Log a few days of spending and I'll start spotting trends.", pose: 'default' };
  }
  if (savingsPct < 0) {
    return { text: 'Spending edged past what came in — worth a peek.', pose: 'sleepy' };
  }
  if (savingsPct >= 20) {
    return {
      text: `You kept ${savingsRateLabel(savingsPct)} of your income this month — lovely pace.`,
      pose: 'default',
    };
  }
  return { text: 'A little put aside this month. Every bit counts.', pose: 'default' };
}
