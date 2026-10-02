import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import type { Loan } from '@/types';

// A loan's colour only says which one it is; the numbers carry the meaning.
const BORROWED_HUES = [
  theme.colors.idGold,
  theme.colors.idCoral,
  theme.colors.primary,
  theme.colors.idTeal,
  theme.colors.idSage,
];

/**
 * Each loan's identity colour, by its place among the borrowed loans (so a
 * loan keeps its colour when another one closes). Money lent is always mint.
 */
export function loanHues(loans: Loan[]): Record<string, string> {
  const hues: Record<string, string> = {};
  let borrowedIndex = 0;
  for (const loan of loans) {
    if (loan.direction === 'lent') {
      hues[loan.id] = theme.colors.secondary;
    } else {
      hues[loan.id] = BORROWED_HUES[borrowedIndex % BORROWED_HUES.length];
      borrowedIndex += 1;
    }
  }
  return hues;
}

/** A home or car icon when the tracked asset says so, else a bank (borrowed) or hand (lent). */
export function loanIcon(loan: Pick<Loan, 'direction' | 'assetLabel'>): string {
  const asset = loan.assetLabel?.toLowerCase() ?? '';
  if (/home|house|flat|apartment|property/.test(asset)) return 'home-outline';
  if (/car|bike|vehicle|scooter/.test(asset)) return 'car-outline';
  return loan.direction === 'borrowed' ? 'bank-outline' : 'hand-coin-outline';
}

const BAR_TONES: Record<string, string> = {
  [theme.colors.idGold]: theme.colors.idGoldDeep,
  [theme.colors.idCoral]: theme.colors.idCoralDeep,
  [theme.colors.primary]: theme.colors.primary,
};

/** The mid-tone a loan's thin bars are drawn in: still inside the pastel band, so it never reads as ink. */
export function loanBarTone(hue: string): string {
  return BAR_TONES[hue] ?? shade(hue, 70);
}

/** The pale fill behind a loan's icon tile. */
export function loanTint(hue: string): string {
  return shade(hue, 93);
}

/** The loan's icon colour on that tile. */
export function loanGlyph(hue: string): string {
  return shade(hue, 30, 10);
}
