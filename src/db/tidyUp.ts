import { getDb } from './client';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { deleteTransaction, restoreTransaction } from './ledger';
import { countFractionalLedgerAmounts } from './maintenance';

/**
 * Tidy up: things in your data that look off, each with a fix — pairs of
 * identical entries, old balances logged as income, and amounts still
 * carrying paise. (An entry without a category can't exist — the schema
 * requires one for income and spending — so there's nothing to find there.) Only plain entries are
 * looked at: anything tied to a loan or a Friends & Family entry is managed
 * from there, never here.
 */

const KEPT_REPEATS_KEY = 'tidy_kept_repeats';
const KEPT_INCOME_KEY = 'tidy_kept_starting_income';

/** A category name that says "this is money I already had": Previous, Opening balance, Carry forward… */
const STARTING_BALANCE_NAME = /\b(previous|opening|balance|carry|carried|starting|brought)\b/i;

// Plain entries only — see the note above.
const PLAIN = `t.loan_id IS NULL AND t.loan_payment_id IS NULL
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
  categoryIcon: string | null;
  categoryColor: string | null;
}

/**
 * Income filed under a "money I already had" category, grouped per account
 * and category — often one entry a month, logged to cover spending from
 * before you started tracking, so it's shown and fixed as one group.
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
}

export interface TidyUpReport {
  repeats: RepeatGroup[];
  startingBalances: StartingBalanceGroup[];
  /** Stored amounts still carrying paise (the old "Round off amounts" count). */
  fractionalCount: number;
}

async function getKeptList(key: string): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  try {
    const parsed = row ? JSON.parse(row.value) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

async function addToKeptList(key: string, value: string): Promise<void> {
  const list = await getKeptList(key);
  if (list.includes(value)) return;
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify([...list, value])]
  );
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
  const rows = await db.getAllAsync<any>(
    `SELECT t.id, t.type, t.account_id, t.to_account_id, t.category_id, t.amount_minor, t.date, t.created_at,
       a.name AS account_name, ta.name AS to_account_name, c.name AS category_name, c.icon AS category_icon,
       c.color AS category_color
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id
     LEFT JOIN categories c ON c.id = t.category_id
     JOIN (
       -- Every combination entered more than once, found in one pass. (A
       -- correlated EXISTS here let SQLite probe by account instead of date:
       -- measured at 80+ seconds for 20,000 entries.)
       SELECT type, account_id, IFNULL(to_account_id, '') AS to_key, IFNULL(category_id, '') AS cat_key,
         amount_minor, date
       FROM transactions
       GROUP BY type, account_id, to_key, cat_key, amount_minor, date
       HAVING COUNT(*) > 1
     ) dup ON dup.type = t.type AND dup.account_id = t.account_id
       AND dup.to_key = IFNULL(t.to_account_id, '') AND dup.cat_key = IFNULL(t.category_id, '')
       AND dup.amount_minor = t.amount_minor AND dup.date = t.date
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
        categoryIcon: r.category_icon ?? null,
        categoryColor: r.category_color ?? null,
      });
    }
  }
  // A group needs two plain entries — the other one might have been a linked row.
  return [...groups.values()].filter((g) => g.ids.length > 1);
}

/** Income filed under a "this is money I already had" category — a balance, not earnings. */
export async function findStartingBalances(): Promise<StartingBalanceGroup[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT t.id, t.account_id, t.category_id, t.amount_minor, t.date, a.name AS account_name,
       c.name AS category_name
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     JOIN categories c ON c.id = t.category_id
     WHERE t.type = 'income' AND c.is_system = 0 AND ${PLAIN}
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
      });
    }
  }
  // Biggest first — usually the one that matters most.
  return [...groups.values()].sort((a, b) => b.totalMinor - a.totalMinor);
}

export async function getTidyUpReport(): Promise<TidyUpReport> {
  const [repeats, startingBalances, fractional] = await Promise.all([
    findRepeatGroups(),
    findStartingBalances(),
    countFractionalLedgerAmounts().catch(() => ({ total: 0 })),
  ]);
  return { repeats, startingBalances, fractionalCount: fractional.total };
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
 * Moves a group of old balances into its account's opening balance: the
 * total is added to the opening balance and the entries deleted, together,
 * so the account's balance doesn't change — only those months' income does.
 */
export async function moveToOpeningBalance(group: StartingBalanceGroup): Promise<OpeningBalanceMove> {
  const db = await getDb();
  const account = await db.getFirstAsync<{ opening_balance_minor: number }>(
    'SELECT opening_balance_minor FROM accounts WHERE id = ?',
    [group.accountId]
  );
  if (!account) throw new Error("These entries' account no longer exists.");
  const transactions: RowSnapshot[] = [];
  for (const id of group.ids) {
    const snapshot = await captureRow(db, 'transactions', id);
    if (!snapshot) throw new Error('Some of these entries are already gone — open Tidy up again.');
    transactions.push(snapshot);
  }
  await db.withTransactionAsync(async (tx) => {
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
