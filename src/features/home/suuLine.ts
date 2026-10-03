import { savingsRateLabel } from '@/lib/savingsRate';
import { formatPctChange } from '@/lib/format';
import { pickRandom } from '@/lib/pickRandom';
import {
  NO_DATA_LINES,
  OVERSPENT_LINES,
  SPEND_UP_TEMPLATES,
  GOOD_SAVINGS_TEMPLATES,
  THIN_SAVINGS_LINES,
  PRIVATE_HEALTHY_LINES,
  PRIVATE_THIN_LINES,
  fillSuuTemplate,
} from './suuLinePools';

export interface SuuLine {
  text: string;
  pose: 'default' | 'sleepy';
}

/**
 * Suu's hero line from real figures, random from a pool (suuLinePools.ts); rising spend beats savings lines.
 * `hour` is required (keeps this pure) and only nudges the pose; `hideSavings` swaps in neutral lines.
 */
export function suuLine(
  savingsPct: number,
  expenseChangePct: number | null,
  topCategoryName?: string | null,
  hour?: number,
  hideSavings = false
): SuuLine {
  const result = ((): SuuLine => {
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
    if (hideSavings) {
      return {
        text: pickRandom(savingsPct >= 20 ? PRIVATE_HEALTHY_LINES : PRIVATE_THIN_LINES),
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
  })();

  const isLateNight = hour != null && (hour >= 23 || hour < 5);
  if (result.pose === 'default' && isLateNight) {
    return { ...result, pose: 'sleepy' };
  }
  return result;
}
