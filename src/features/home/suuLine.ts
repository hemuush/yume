import { savingsRateLabel } from '@/lib/savingsRate';
import { formatPctChange } from '@/lib/format';
import { pickRandom } from '@/lib/pickRandom';
import {
  NO_DATA_LINES,
  OVERSPENT_LINES,
  SPEND_UP_TEMPLATES,
  GOOD_SAVINGS_TEMPLATES,
  THIN_SAVINGS_LINES,
  fillSuuTemplate,
} from './suuLinePools';

export interface SuuLine {
  text: string;
  pose: 'default' | 'sleepy';
}

/**
 * The one encouraging line Suu says in the Home hero. Derived entirely from
 * this period's real figures — never a placeholder — and picked at random
 * from a ~20-line pool for whichever situation applies (see
 * `suuLinePools.ts`), so Suu doesn't repeat the exact same sentence every
 * time this runs (every Home focus). The five *situations* below are
 * unchanged; only the wording within each one now varies.
 *
 * Previously a spending-is-up nudge lived in its own separate
 * `SpendingAlertCard`, which restated the exact "N% vs last" figure the hero
 * card already showed one line above it — a real duplication, removed in
 * favour of folding that one fact in here instead. Whenever spending is up
 * at all, that takes priority over the savings-rate messages below: telling
 * someone "lovely pace" while their spend just rose isn't useful, however
 * healthy their overall savings rate still looks.
 *
 * @param savingsPct  raw savings rate (net ÷ income × 100); may be negative
 * @param expenseChangePct  spend vs the previous period, or null when there's
 *                          no comparison yet (a fresh install / empty month)
 * @param topCategoryName  the category that grew the most, if any grew
 *                         >20% — folded into the sentence as "— mostly X."
 */
export function suuLine(
  savingsPct: number,
  expenseChangePct: number | null,
  topCategoryName?: string | null
): SuuLine {
  if (expenseChangePct == null) {
    return { text: pickRandom(NO_DATA_LINES), pose: 'default' };
  }
  if (savingsPct < 0) {
    return { text: pickRandom(OVERSPENT_LINES), pose: 'sleepy' };
  }
  if (expenseChangePct > 0) {
    const base = fillSuuTemplate(pickRandom(SPEND_UP_TEMPLATES), formatPctChange(expenseChangePct));
    return {
      text: `${base}${topCategoryName ? ` — mostly ${topCategoryName}.` : '.'}`,
      pose: 'default',
    };
  }
  if (savingsPct >= 20) {
    return {
      text: fillSuuTemplate(pickRandom(GOOD_SAVINGS_TEMPLATES), savingsRateLabel(savingsPct)),
      pose: 'default',
    };
  }
  return { text: pickRandom(THIN_SAVINGS_LINES), pose: 'default' };
}
