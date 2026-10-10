import { createTransaction } from '@/db/ledger';
import { recordMoneyGivenToPerson, recordMoneyReceivedFromPerson, addLedgerEntry } from '@/db/people';
import type { Category } from '@/types';
import type { Staged } from './addEntry';

/** "1,501" while typing "1500.5": amounts are kept in whole units, so the card shows the figure that will be saved. */
export function formatTyped(expr: string): string {
  if (expr === '') return '0';
  const whole = Math.round(Number(expr.endsWith('.') ? expr.slice(0, -1) : expr) || 0);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(whole);
}

/** Money in and out across the staged list; a friend entry counts by which way the cash moved. */
export function stagedTotals(rows: Staged[]): { income: number; expense: number } {
  return rows.reduce(
    (acc, r) => {
      if (r.kind === 'transaction') {
        if (r.type === 'income') acc.income += r.amountMinor;
        if (r.type === 'expense') acc.expense += r.amountMinor;
      } else if (r.accountId) {
        if (r.sign === -1) acc.income += r.amountMinor;
        else acc.expense += r.amountMinor;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );
}

/** The category a friend entry is filed under: "Friends & Family", else a sensible catch-all of that kind. */
function friendCategory(categories: Category[], sign: 1 | -1): Category | undefined {
  const [kind, fallback] =
    sign === 1 ? (['expense', 'Miscellaneous'] as const) : (['income', 'Other Income'] as const);
  return (
    // The built-in one first: a user's own category with the same name must not capture friend entries.
    categories.find((c) => c.kind === kind && c.isSystem && c.name === 'Friends & Family') ??
    categories.find((c) => c.kind === kind && c.name === 'Friends & Family') ??
    categories.find((c) => c.kind === kind && c.name === fallback) ??
    categories.find((c) => c.kind === kind)
  );
}

/** Saves one staged row; the new entry's id when it's a plain entry (friend entries don't hand one back). */
export async function persistStaged(r: Staged, categories: Category[]): Promise<string | null> {
  if (r.kind === 'friend') {
    if (r.accountId) {
      const category = friendCategory(categories, r.sign);
      if (!category) throw new Error('No category available for this friend entry');
      const payload = {
        personId: r.personId,
        accountId: r.accountId,
        categoryId: category.id,
        amountMinor: r.amountMinor,
        date: r.date,
        note: r.note,
      };
      if (r.sign === 1) await recordMoneyGivenToPerson(payload);
      else await recordMoneyReceivedFromPerson(payload);
    } else {
      await addLedgerEntry({
        personId: r.personId,
        amountMinor: r.amountMinor * r.sign,
        date: r.date,
        note: r.note,
      });
    }
    return null;
  }
  const created = await createTransaction({
    type: r.type,
    accountId: r.accountId,
    toAccountId: r.toAccountId,
    categoryId: r.categoryId,
    amountMinor: r.amountMinor,
    date: r.date,
    note: r.note,
    isRefund: !!r.isRefund,
  });
  return created.id;
}

/** What the Save button says: the state it is in, then what it will save. */
export function saveButtonTitle({
  saving,
  editing,
  split,
  refund,
  repeatWarning,
  rowCount,
  hasCurrent = false,
}: {
  saving: boolean;
  editing: boolean;
  split: boolean;
  refund: boolean;
  repeatWarning: boolean;
  rowCount: number;
  hasCurrent?: boolean;
}): string {
  if (saving) return 'Saving…';
  if (editing) return 'Save changes';
  if (split) return 'Save split';
  if (refund && rowCount === 0) return 'Save refund';
  if (repeatWarning) return 'Save anyway';
  const count = rowCount + (hasCurrent ? 1 : 0);
  if (rowCount > 0) return `Save ${count} ${count === 1 ? 'entry' : 'entries'}`;
  return 'Save';
}
