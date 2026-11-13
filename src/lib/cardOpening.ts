import { toMajor, toMinor } from './money';
import type { Account } from '@/types';

/**
 * A credit card's balance is what is in it, so it is negative while money is owed (see `cardUsage`). The
 * number pad has no minus key, so the opening balance of a card is typed as what is owed on it today and
 * stored as the negative. Without this, a card that already carries a bill was saved as money in the card
 * and counted as cash in every total.
 */
export const isCard = (type: Account['type']) => type === 'credit_card';

/** The opening-balance field's label: what the number means depends on the account. */
export function openingLabel(type: Account['type'], tracked: boolean): string {
  if (isCard(type)) return 'Owed on it now';
  return tracked ? 'Invested before Yume' : 'Opening balance';
}

const clean = (n: number) => (n === 0 ? 0 : n);

/** The typed opening-balance text as the amount stored: a card's text is what it owes, so it is negated. */
export function openingToMinor(type: Account['type'], text: string): number {
  const minor = toMinor(parseFloat(text || '0'));
  return clean(isCard(type) && Number.isFinite(minor) ? -minor : minor);
}

/** The stored opening balance as the field's text, the inverse of `openingToMinor` (whole units). */
export function openingToField(type: Account['type'], minor: number): string {
  return String(clean(toMajor(isCard(type) ? -minor : minor)));
}
