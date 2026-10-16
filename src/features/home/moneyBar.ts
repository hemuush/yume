import type { HeroSlices } from './heroSlices';

export type MoneyBarKey = 'spent' | 'saved' | 'due' | 'free';

export interface MoneyBarSegment {
  key: MoneyBarKey;
  /** Its share of the period's money, 0–1. */
  share: number;
}

/**
 * The month card's thin bar: where the period's money went as spent, saved, still to pay and free, in that
 * order, from the same split as the rest of the card. Empty parts are left out; with savings hidden the saved
 * part is simply absent and the bar ends early. No income, no bar.
 */
export function moneyBarSegments(slices: HeroSlices): MoneyBarSegment[] {
  if (!slices.hasIncome) return [];
  const parts: MoneyBarSegment[] = [
    { key: 'spent', share: slices.spent },
    { key: 'saved', share: slices.saved },
    { key: 'due', share: slices.due ?? 0 },
    { key: 'free', share: slices.free },
  ];
  return parts.filter((p) => p.share > 0);
}
