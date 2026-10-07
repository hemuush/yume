import { TransactionRow } from './rows';
import { getDb } from './client';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { deleteTransaction, restoreTransaction } from './ledger';
import { countFractionalLedgerAmounts } from './maintenance';
import { cachedRead } from './readCache';
import { sensitiveOf } from './spendSql';

/**
 * Tidy up: data that looks off, each fixable: identical-entry pairs, old balances logged as income, paise.
 * Plain entries only; loan- or Friends & Family-linked ones are managed from there.
 */

const KEPT_REPEATS_KEY = 'tidy_kept_repeats';
const KEPT_INCOME_KEY = 'tidy_kept_starting_income';

/** A category name that says "this is money I already had": Previous, Opening balance, Carry forward… */
const STARTING_BALANCE_NAME = /\b(previous|opening|balance|carry|carried|starting|brought)\b/i;

// Plain entries only — see the note above: not tied to a loan or a person, and not part of a split payment.
const PLAIN = `t.loan_id IS NULL AND t.loan_payment_id IS NULL AND t.split_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM loan_payments lp WHERE lp.transaction_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM person_ledger_entries pe WHERE pe.transaction_id = t.id)`;

export interface RepeatGroup {
  /** Identifies the group across runs — what "Keep both" remembers. */
  key: string;
  /** Oldest first. */
  ids: string[];
  savedAt: string[];
  type: 'income' | 'expense' | 'transfer';
  amountMinor: number;
  date: string;
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
  parentName?: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  /** Savings or investments (a hidden category, or a transfer into or out of savings): masked while hidden. */
  isSavings: boolean;
}

/**
 * Income under a "money I already had" category, grouped per account and category (often one entry a month,
 * covering pre-tracking spending), so it's shown and fixed as one group.
 */
export interface StartingBalanceGroup {
  /** "accountId|categoryId" — what "They're real income" remembers. */
  key: string;
  accountId: string;
  accountName: string;
  categoryName: string;
  ids: string[];
  totalMinor: number;
  firstDate: string;
  lastDate: string;
  /** Its category is hidden with "hide savings & investment amounts": the total shows masked then. */
  isSavings: boolean;
}

export interface TidyUpReport {
  repeats: RepeatGroup[];
  startingBalances: StartingBalanceGroup[];
  /** Stored amounts still carrying paise (the old "Round off amounts" count). */
  fractionalCount: number;
}

function parseKeptList(raw: string | undefined): string[] {
  try {
    const parsed = raw !== undefined ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

async function getKeptList(key: string): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return parseKeptList(row?.value);
}

async function addToKeptList(key: string, value: string): Promise<void> {
  const db = await getDb();
  // Read-modify-write in one transaction, so two quick "Keep" taps can't both read the old list and lose one.
  await db.withTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    const list = parseKeptList(row?.value);
    if (list.includes(value)) return;
    await tx.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify([...list, value])]
    );
  });
}

const repeatKeyOf = (r: {
  type: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  amount_minor: number;
  date: string;
}) => [r.type, r.account_id, r.to_account_id ?? '', r.category_id ?? '', r.amount_minor, r.date].join('|');

/** Same type, account(s), category, amount and date — the same test Add's repeat check uses. */
export async function findRepeatGroups(): Promise<RepeatGroup[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    Pick<
      TransactionRow,
      'id' | 'type' | 'account_id' | 'to_account_id' | 'category_id' | 'amount_minor' | 'date' | 'created_at'
    > & {
      account_name: string;
      to_account_name: string | null;
      category_name: string | null;
      parent_name: string | null;
      category_icon: string | null;
      category_color: string | null;
      is_savings: number;
    }
  >(
    `SELECT t.id, t.type, t.account_id, t.to_account_id, t.category_id, t.amount_minor, t.date, t.created_at,
       a.name AS account_name, ta.name AS to_account_name, c.name AS category_name, pc.name AS parent_name,
       c.icon AS category_icon, c.color AS category_color,
       CASE WHEN t.type = 'transfer' THEN (a.type = 'savings' OR IFNULL(ta.type, '') = 'savings')
            ELSE COALESCE(${sensitiveOf('c')}, 0) END AS is_savings
     FROM (
       -- Every combination entered more than once, found in one pass. (A correlated EXISTS here let SQLite
       -- probe by account instead of date: measured at 80+ seconds for 20,000 entries.) Grouped on the plain
       -- columns in idx_transactions_repeat's order, so SQLite walks that index instead of sorting the whole
       -- table (GROUP BY treats NULLs as equal, as the old IFNULL keys did).
       SELECT date, amount_minor, type, account_id, category_id, to_account_id
       FROM transactions
       GROUP BY date, amount_minor, type, account_id, category_id, to_account_id
       HAVING COUNT(*) > 1
     ) dup
     -- CROSS JOIN fixes the order: the few repeated combinations first, each entry then found through the
     -- same index, instead of checking every entry in the ledger against them.
     CROSS JOIN transactions t ON t.date = dup.date AND t.amount_minor = dup.amount_minor AND t.type = dup.type
       AND t.account_id = dup.account_id AND t.category_id IS dup.category_id
       AND t.to_account_id IS dup.to_account_id
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE ${PLAIN}
     ORDER BY t.date DESC, t.created_at ASC`
  );
  const kept = new Set(await getKeptList(KEPT_REPEATS_KEY));
  const groups = new Map<string, RepeatGroup>();
  for (const r of rows) {
    const key = repeatKeyOf(r);
    if (kept.has(key)) continue;
    const g = groups.get(key);
    if (g) {
      g.ids.push(r.id);
      g.savedAt.push(r.created_at);
    } else {
      groups.set(key, {
        key,
        ids: [r.id],
        savedAt: [r.created_at],
        type: r.type,
        amountMinor: r.amount_minor,
        date: r.date,
        accountName: r.account_name,
        toAccountName: r.to_account_name ?? null,
        categoryName: r.category_name ?? null,
        parentName: r.parent_name ?? null,
        categoryIcon: r.category_icon ?? null,
        categoryColor: r.category_color ?? null,
        isSavings: !!r.is_savings,
      });
    }
  }
  // A group needs two plain entries — the other one might have been a linked row.
  return [...groups.values()].filter((g) => g.ids.length > 1);
}

/** Income filed under a "this is money I already had" category — a balance, not earnings. */
export async function findStartingBalances(): Promise<StartingBalanceGroup[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    Pick<TransactionRow, 'id' | 'account_id' | 'amount_minor' | 'date'> & {
      category_id: string;
      account_name: string;
      category_name: string;
      is_savings: number;
    }
  >(
    `SELECT t.id, t.account_id, t.category_id, t.amount_minor, t.date, a.name AS account_name,
       c.name AS category_name, ${sensitiveOf('c')} AS is_savings
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     JOIN categories c ON c.id = t.category_id
     WHERE t.type = 'income' AND t.is_refund = 0 AND c.is_system = 0 AND ${PLAIN}
     ORDER BY t.date ASC`
  );
  const kept = new Set(await getKeptList(KEPT_INCOME_KEY));
  const groups = new Map<string, StartingBalanceGroup>();
  for (const r of rows) {
    if (!STARTING_BALANCE_NAME.test(r.category_name)) continue;
    const key = `${r.account_id}|${r.category_id}`;
    if (kept.has(key)) continue;
    const g = groups.get(key);
    if (g) {
      g.ids.push(r.id);
      g.totalMinor += r.amount_minor;
      g.lastDate = r.date;
    } else {
      groups.set(key, {
        key,
        accountId: r.account_id,
        accountName: r.account_name,
        categoryName: r.category_name,
        ids: [r.id],
        totalMinor: r.amount_minor,
        firstDate: r.date,
        lastDate: r.date,
        isSavings: !!r.is_savings,
      });
    }
  }
  // Biggest first — usually the one that matters most.
  return [...groups.values()].sort((a, b) => b.totalMinor - a.totalMinor);
}

export function getTidyUpReport(): Promise<TidyUpReport> {
  // Scans the whole ledger; Home's Needs you and the Tidy up screen share one result until the data changes.
  return cachedRead('tidyUp', async () => {
    const [repeats, startingBalances, fractional] = await Promise.all([
      findRepeatGroups(),
      findStartingBalances(),
      countFractionalLedgerAmounts().catch(() => ({ total: 0 })),
    ]);
    return { repeats, startingBalances, fractionalCount: fractional.total };
  });
}

/** How many things Tidy up has for you — each repeat pair and group of old balances, plus one for paise. */
export function tidyUpCount(report: TidyUpReport): number {
  return report.repeats.length + report.startingBalances.length + (report.fractionalCount > 0 ? 1 : 0);
}

/** "Keep both": this group is fine as it is, and won't be shown again. */
export async function keepRepeatGroup(key: string): Promise<void> {
  await addToKeptList(KEPT_REPEATS_KEY, key);
}

/** "They're real income": this group stays as income, and won't be shown again. */
export async function keepAsIncome(groupKey: string): Promise<void> {
  await addToKeptList(KEPT_INCOME_KEY, groupKey);
}

/** Deletes the most recently saved entry of a repeat group. Returns what undo needs. */
export async function deleteNewestOfGroup(group: RepeatGroup): Promise<RowSnapshot> {
  return deleteTransaction(group.ids[group.ids.length - 1]);
}

export async function undoDeleteNewestOfGroup(snapshot: RowSnapshot): Promise<void> {
  await restoreTransaction(snapshot);
}

export interface OpeningBalanceMove {
  transactions: RowSnapshot[];
  accountId: string;
  previousOpeningMinor: number;
}

/**
 * Moves a group of old balances into its account's opening balance: the total is added to it and the entries
 * deleted together, so the account's balance is unchanged and only those months' income drops.
 */
export async function moveToOpeningBalance(group: StartingBalanceGroup): Promise<OpeningBalanceMove> {
  const db = await getDb();
  const account = await db.getFirstAsync<{ opening_balance_minor: number }>(
    'SELECT opening_balance_minor FROM accounts WHERE id = ?',
    [group.accountId]
  );
  if (!account) throw new Error("These entries' account no longer exists.");
  const transactions: RowSnapshot[] = [];
  // Captured in the same transaction that deletes them, so the undo snapshot is exactly what was removed.
  await db.withTransactionAsync(async (tx) => {
    for (const id of group.ids) {
      const snapshot = await captureRow(tx, 'transactions', id);
      if (!snapshot) throw new Error('Some of these entries are already gone — open Tidy up again.');
      transactions.push(snapshot);
    }
    await tx.runAsync('UPDATE accounts SET opening_balance_minor = opening_balance_minor + ? WHERE id = ?', [
      group.totalMinor,
      group.accountId,
    ]);
    for (const id of group.ids) await tx.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  });
  return { transactions, accountId: group.accountId, previousOpeningMinor: account.opening_balance_minor };
}

export async function undoMoveToOpeningBalance(move: OpeningBalanceMove): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE accounts SET opening_balance_minor = ? WHERE id = ?', [
      move.previousOpeningMinor,
      move.accountId,
    ]);
    for (const snapshot of move.transactions) await restoreRow(tx, snapshot);
  });
}
