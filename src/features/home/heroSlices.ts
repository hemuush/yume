/**
 * Home moon split of income into spent/savings/free (+ a bills slice); sums to 1, or all 0 with no income.
 * Overspent: all spent. Savings caps at what's left (free 0). Money out of savings counts 0, falls into free.
 */
export interface HeroSlices {
  spent: number;
  saved: number;
  free: number;
  /** Still to pay this month; only present when something is due. */
  due?: number;
  /** Spent beyond income, in minor units; 0 unless overspent. */
  overMinor: number;
  hasIncome: boolean;
}

export function heroSlices(
  incomeMinor: number,
  spentMinor: number,
  savingsMinor: number,
  dueMinor = 0
): HeroSlices {
  if (!(incomeMinor > 0)) return { spent: 0, saved: 0, free: 0, overMinor: 0, hasIncome: false };
  const spent = Math.max(0, spentMinor);
  if (spent >= incomeMinor) {
    return { spent: 1, saved: 0, free: 0, overMinor: spent - incomeMinor, hasIncome: true };
  }
  const room = incomeMinor - spent;
  const saved = Math.min(Math.max(0, savingsMinor), room);
  const due = Math.min(Math.max(0, dueMinor), room - saved);
  return {
    spent: spent / incomeMinor,
    saved: saved / incomeMinor,
    free: (room - saved - due) / incomeMinor,
    ...(due > 0 ? { due: due / incomeMinor } : {}),
    overMinor: 0,
    hasIncome: true,
  };
}

/** Headline views shared by Home and the monthly widget. */
export type HeroMode = 'kept' | 'spent' | 'saved' | 'free';

/** "54%", or "<1%" for a real but tiny share rather than a misleading "0%". */
export function heroPct(fraction: number): string {
  const v = fraction * 100;
  return v > 0 && v < 1 ? '<1%' : `${Math.round(v)}%`;
}

/** Each headline view's share of income â€” "kept" is savings plus free to use. */
export function heroShare(s: HeroSlices, mode: HeroMode): number {
  return mode === 'kept' ? s.saved + s.free : s[mode];
}

/** The resting headline: Kept, or Spent when nothing was kept. With savings hidden, Free or Spent. */
export function heroRestingMode(s: HeroSlices, hideSavings = false): HeroMode {
  if (hideSavings) return s.free > 0 ? 'free' : 'spent';
  return heroShare(s, 'kept') > 0 ? 'kept' : 'spent';
}

/**
 * Same split with the savings arc dropped for hide-savings: the ring draws spent and free only,
 * savings share stays empty track, and free keeps its real share.
 */
export function withoutSavings(s: HeroSlices): HeroSlices {
  return { ...s, saved: 0 };
}
