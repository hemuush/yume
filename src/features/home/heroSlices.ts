/**
 * How Home's moon splits a period's income: what was spent, what was moved
 * into savings accounts, and what's left free to use. The three fractions
 * always add up to 1 (or all 0 with no income), so the moon never
 * double-counts and never shows more than came in.
 *
 * - Overspent (spent ≥ income): the whole moon is spent; `overMinor` says by
 *   how much.
 * - More moved into savings than was left after spending: savings fills the
 *   rest and free-to-use is 0 (the figure below the moon still shows the
 *   real, negative free-to-use amount).
 * - Money taken *out* of savings (a negative savings contribution): counted
 *   as 0 to savings; what came out is part of free to use — the same
 *   arithmetic as the Free to use figure itself (income − spent − savings).
 */
export interface HeroSlices {
  spent: number;
  saved: number;
  free: number;
  /** Spent beyond income, in minor units; 0 unless overspent. */
  overMinor: number;
  hasIncome: boolean;
}

export function heroSlices(incomeMinor: number, spentMinor: number, savingsMinor: number): HeroSlices {
  if (!(incomeMinor > 0)) return { spent: 0, saved: 0, free: 0, overMinor: 0, hasIncome: false };
  const spent = Math.max(0, spentMinor);
  if (spent >= incomeMinor) {
    return { spent: 1, saved: 0, free: 0, overMinor: spent - incomeMinor, hasIncome: true };
  }
  const room = incomeMinor - spent;
  const saved = Math.min(Math.max(0, savingsMinor), room);
  return {
    spent: spent / incomeMinor,
    saved: saved / incomeMinor,
    free: (room - saved) / incomeMinor,
    overMinor: 0,
    hasIncome: true,
  };
}

/** The moon's headline views, in the order tapping the moon steps through them. */
export type HeroMode = 'kept' | 'spent' | 'saved' | 'free';
const HERO_MODES: HeroMode[] = ['kept', 'spent', 'saved', 'free'];
export const HERO_MODE_LABEL: Record<HeroMode, string> = {
  kept: 'Kept',
  spent: 'Spent',
  saved: 'To savings',
  free: 'Free to use',
};

/** "54%", or "<1%" for a real but tiny share rather than a misleading "0%". */
export function heroPct(fraction: number): string {
  const v = fraction * 100;
  return v > 0 && v < 1 ? '<1%' : `${Math.round(v)}%`;
}

/** Each headline view's share of income — "kept" is savings plus free to use. */
export function heroShare(s: HeroSlices, mode: HeroMode): number {
  return mode === 'kept' ? s.saved + s.free : s[mode];
}

/**
 * The views worth showing for these slices, in tap order: only ones with a
 * real share, so a month where everything went out doesn't step through
 * "0% kept", "0% to savings", "0% free to use". Empty with no income or when
 * overspent (the moon then has nothing to split).
 */
export function heroModes(s: HeroSlices): HeroMode[] {
  if (!s.hasIncome || s.overMinor > 0) return [];
  return HERO_MODES.filter((m) => heroShare(s, m) > 0);
}

/** The resting headline: Kept, or Spent when nothing was kept. */
export function heroRestingMode(s: HeroSlices): HeroMode {
  return heroShare(s, 'kept') > 0 ? 'kept' : 'spent';
}
