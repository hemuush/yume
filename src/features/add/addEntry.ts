import { Account, Category, TransactionType } from '@/types';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { parseLocalIsoDate } from '@/lib/date';
import { parentNameOf } from '@/lib/categoryLabel';

export type EntryType = TransactionType | 'friend';

export const ADD_TYPES: { label: string; value: EntryType }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Friend', value: 'friend' },
];
export const EDIT_TYPES = ADD_TYPES.slice(0, 3);

// Same trick as QuickActionsRow: the pale sky-blue/lavender accents are too light as text on cream.
const TRANSFER_TEXT = shade(theme.colors.primary, 45, 8);
const FRIEND_TEXT = shade(theme.colors.accent, 45, 8);

/**
 * A wash colour + readable accent per entry type (four existing theme tokens), so the type reads from the
 * top of the screen, as colour already does for Income/Spent on Home.
 */
export const TYPE_WASH: Record<EntryType, { bg: string; accent: string }> = {
  expense: { bg: theme.colors.idCoral, accent: theme.colors.idCoralDeep },
  income: { bg: theme.colors.incomeTint, accent: theme.colors.income },
  transfer: { bg: theme.colors.primaryTint, accent: TRANSFER_TEXT },
  friend: { bg: theme.colors.accentTint, accent: FRIEND_TEXT },
};

/** TYPE_WASH, with Transfer's sky wash following the picked theme's accent when one is given. */
export function typeWash(type: EntryType, accent?: string): { bg: string; accent: string } {
  if (type !== 'transfer' || !accent) return TYPE_WASH[type];
  return { bg: shade(accent, 95), accent: shade(accent, 45, 8) };
}

interface StagedTx {
  id: string;
  kind: 'transaction';
  type: TransactionType;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  label: string;
  /** The category's parent, when it is a subcategory. */
  parentName?: string;
  categoryIcon: string;
  categoryColor: string;
  amountMinor: number;
  date: string;
  note: string;
  /** Money back for a purchase: saved as money in against its expense category. */
  isRefund?: boolean;
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

/**
 * What makes two entries "the same" for the repeat check: type, account(s), category, amount, date.
 * The note is ignored: the same coffee is often logged with and without one.
 */
export function repeatKey(r: StagedTx): string {
  return [r.type, r.accountId, r.toAccountId ?? '', r.categoryId ?? '', r.amountMinor, r.date].join('|');
}

export function isTxType(v: string | undefined): v is TransactionType {
  return v === 'expense' || v === 'income' || v === 'transfer';
}

export function dateChipLabel(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Everything on the Add form that a staged entry is built from. */
export interface AddForm {
  type: EntryType;
  amountMinor: number;
  date: string;
  note: string;
  /** The account the entry is on (a transfer's "from"), after defaults. */
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  personId: string | null;
  friendSign: 1 | -1;
  friendAccountId: string | null;
  /** "Money back" on the Expense tab: this is a refund, not a purchase. */
  refund?: boolean;
}

/**
 * Validates the form into a staged entry or returns what's missing, in form order: amount, person/account,
 * category, same-currency transfer destination (a createTransaction rule). `id` only keys rows.
 */
export function formToStaged(
  form: AddForm,
  lookups: { accounts: Account[]; categories: Category[]; people: { id: string; name: string }[] },
  id: string = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
): { row: Staged } | { error: string } {
  const { type, amountMinor, date, note, accountId, toAccountId, categoryId } = form;
  if (amountMinor <= 0) return { error: 'Enter a valid amount' };

  if (type === 'friend') {
    if (!form.personId) return { error: 'Pick a person' };
    const person = lookups.people.find((p) => p.id === form.personId);
    const acc = form.friendAccountId ? lookups.accounts.find((a) => a.id === form.friendAccountId) : null;
    return {
      row: {
        id,
        kind: 'friend',
        personId: form.personId,
        personName: person?.name ?? '—',
        sign: form.friendSign,
        accountId: form.friendAccountId,
        accountName: acc?.name ?? null,
        amountMinor,
        date,
        note,
      },
    };
  }

  if (!accountId) return { error: 'Pick an account' };
  if (type !== 'transfer' && !categoryId) return { error: 'Pick a category' };
  if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
    return { error: 'Pick a different destination account' };
  }
  if (type === 'transfer') {
    const fromCurrency = lookups.accounts.find((a) => a.id === accountId)?.currency;
    const toCurrency = lookups.accounts.find((a) => a.id === toAccountId)?.currency;
    if (fromCurrency && toCurrency && fromCurrency !== toCurrency) {
      return { error: `These accounts use different currencies (${fromCurrency} and ${toCurrency})` };
    }
  }
  const cat = lookups.categories.find((c) => c.id === categoryId);
  // A refund is money in, back to the expense category it came from (db/spendSql.ts).
  const asRefund = type === 'expense' && !!form.refund;
  return {
    row: {
      id,
      kind: 'transaction',
      type: asRefund ? 'income' : type,
      ...(asRefund ? { isRefund: true } : {}),
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'transfer' ? null : categoryId,
      label: type === 'transfer' ? 'Transfer' : (cat?.name ?? '—'),
      parentName:
        type === 'transfer'
          ? undefined
          : parentNameOf(categoryId, new Map(lookups.categories.map((c) => [c.id, c]))),
      categoryIcon: type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'tag'),
      categoryColor: type === 'transfer' ? theme.colors.secondary : (cat?.color ?? theme.colors.textMuted),
      amountMinor,
      date,
      note,
    },
  };
}
