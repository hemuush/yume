import { TransactionType } from '@/types';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { parseLocalIsoDate } from '@/lib/date';

export type EntryType = TransactionType | 'friend';

export const ADD_TYPES: { label: string; value: EntryType }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Friend', value: 'friend' },
];
export const EDIT_TYPES = ADD_TYPES.slice(0, 3);

// Same technique QuickActionsRow already uses to get readable small-caps
// text out of the app's pale sky-blue/lavender accents, which are too
// light at their own lightness to read as text on cream.
const TRANSFER_TEXT = shade(theme.colors.primary, 45, 8);
const FRIEND_TEXT = shade(theme.colors.accent, 45, 8);

/**
 * A wash colour + a readable accent tone per entry type, all four already-
 * existing theme tokens — confirms "this is an expense/income/transfer/
 * friend entry" from the top of the screen down, the same job colour
 * already does for Income/Spent on Home, just moved earlier in this flow.
 */
export const TYPE_WASH: Record<EntryType, { bg: string; accent: string }> = {
  expense: { bg: theme.colors.idCoral, accent: theme.colors.idCoralDeep },
  income: { bg: theme.colors.incomeTint, accent: theme.colors.income },
  transfer: { bg: theme.colors.primaryTint, accent: TRANSFER_TEXT },
  friend: { bg: theme.colors.accentTint, accent: FRIEND_TEXT },
};

interface StagedTx {
  id: string;
  kind: 'transaction';
  type: TransactionType;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  label: string;
  categoryIcon: string;
  categoryColor: string;
  amountMinor: number;
  date: string;
  note: string;
}
interface StagedFriend {
  id: string;
  kind: 'friend';
  personId: string;
  personName: string;
  sign: 1 | -1;
  accountId: string | null;
  accountName: string | null;
  amountMinor: number;
  date: string;
  note: string;
}
export type Staged = StagedTx | StagedFriend;

export function isTxType(v: string | undefined): v is TransactionType {
  return v === 'expense' || v === 'income' || v === 'transfer';
}

export function dateChipLabel(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
