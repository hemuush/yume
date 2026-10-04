import { found } from './found';
import { TransactionRow } from './rows';
import { getDb, AppDb, SqlParam } from './client';
import { newId } from '@/lib/id';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { getDefaultCurrency } from './settings';
import { Transaction, TransactionType, PaymentMode } from '@/types';
import { toLocalIsoDate, addDaysToIsoDate, isIsoDate, parseLocalIsoDate } from '@/lib/date';
import { parseSearchQuery } from '@/lib/searchQuery';

import { queueSpendAlerts } from './spendAlerts';
import { rebuildNotifications } from '@/lib/notifications';
import { keepDeletedEntry, forgetDeletedEntry } from './recentlyDeleted';

/** Entries: create, list, search, repeat checks, links and delete (re-exported from ./ledger). */

export function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    date: row.date,
    note: row.note,
    paymentMode: row.payment_mode,
    loanPaymentId: row.loan_payment_id,
    splitId: row.split_id ?? null,
    isRefund: !!row.is_refund,
    dayRank: row.day_rank ?? null,
    splitTotalMinor: row.split_total_minor ?? null,
    createdAt: row.created_at,
  };
}

export interface CreateTransactionInput {
  type: TransactionType;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amountMinor: number;
  date: string;
  note?: string;
  paymentMode?: PaymentMode | null;
  loanPaymentId?: string | null;
  /** Set on each part of a split payment (see db/splits.ts). */
  splitId?: string | null;
  /** Money back for a purchase: must be type 'income' against an expense category. */
  isRefund?: boolean;
}

/**
 * Savings accounts aren't spendable in place: money must transfer out before it's logged as income or
 * expense. Enforced here, not only in pickers, so every writer (recurring, friend ledger, imports...) obeys.
 */
export async function assertSpendableAccount(type: TransactionType, accountId: string): Promise<void> {
  if (type === 'transfer') return;
  const db = await getDb();
  const acc = await db.getFirstAsync<{ type: string }>('SELECT type FROM accounts WHERE id = ?', [accountId]);
  if (acc?.type === 'savings') {
    throw new Error(
      'Savings accounts can’t be used for income or expenses — transfer to a spendable account first.'
    );
  }
}

/**
 * A transfer moves the same stored number between accounts (the schema has no exchange rate), so across
 * currencies it would silently turn ₹1,000 into $1,000. Rejected until real conversion exists.
 */
export async function assertSameCurrencyTransfer(
  type: TransactionType,
  accountId: string,
  toAccountId: string | null | undefined
): Promise<void> {
  if (type !== 'transfer' || !toAccountId) return;
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; currency: string }>(
    'SELECT id, currency FROM accounts WHERE id IN (?, ?)',
    [accountId, toAccountId]
  );
  const from = rows.find((r) => r.id === accountId)?.currency;
  const to = rows.find((r) => r.id === toAccountId)?.currency;
  if (from && to && from !== to) {
    throw new Error(
      `These accounts use different currencies (${from} and ${to}) — Yume can't convert between them, so a transfer between them isn't supported.`
    );
  }
}

/** An entry's date must be a real calendar day (not "2026-02-31"): anything else drops out of every month's totals. */
function assertRealDate(date: string): void {
  if (!isIsoDate(date) || toLocalIsoDate(parseLocalIsoDate(date)) !== date) {
    throw new Error('Pick a valid date');
  }
}

/**
 * Every check createTransaction applies before writing; shared with runDueRecurringRules, which inserts inside
 * a transaction (see insertTransactionRow) yet must apply the same rules as a hand-typed entry.
 */
export async function assertValidTransactionInput(input: CreateTransactionInput): Promise<void> {
  assertRealDate(input.date);
  if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive number');
  }
  if (input.amountMinor > MAX_AMOUNT_MINOR) {
    throw new Error('That amount is too large');
  }
  if (input.type === 'transfer' && !input.toAccountId) {
    throw new Error('Transfer requires a destination account');
  }
  if (input.type === 'transfer' && input.toAccountId === input.accountId) {
    throw new Error('Cannot transfer to the same account');
  }
  if (input.type !== 'transfer' && !input.categoryId) {
    throw new Error('Income/expense requires a category');
  }
  await assertSpendableAccount(input.type, input.accountId);
  await assertSameCurrencyTransfer(input.type, input.accountId, input.toAccountId);
  if (input.isRefund) await assertRefundTarget(input.type, input.categoryId);
}

/** A refund is money in, back to a spending category. */
async function assertRefundTarget(
  type: TransactionType,
  categoryId: string | null | undefined
): Promise<void> {
  if (type !== 'income') throw new Error('A refund is money coming back in');
  const db = await getDb();
  const cat = await db.getFirstAsync<{ kind: string }>('SELECT kind FROM categories WHERE id = ?', [
    categoryId ?? '',
  ]);
  if (cat?.kind !== 'expense') throw new Error('A refund goes back to a spending category');
}

/**
 * The raw INSERT behind createTransaction, on the outer db or a `tx` inside withTransactionAsync
 * (createTransaction would deadlock there). Does no validation: run assertValidTransactionInput first.
 */
export async function insertTransactionRow(db: AppDb, input: CreateTransactionInput): Promise<string> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO transactions
      (id, type, account_id, to_account_id, category_id, amount_minor, date, note, payment_mode, loan_payment_id, split_id, is_refund)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.accountId,
      input.toAccountId ?? null,
      input.categoryId ?? null,
      input.amountMinor,
      input.date,
      input.note ?? '',
      input.paymentMode ?? null,
      input.loanPaymentId ?? null,
      input.splitId ?? null,
      input.isRefund ? 1 : 0,
    ]
  );
  return id;
}

/**
 * Post-write notifications (queueSpendAlerts): a current-month expense may queue an alert (which rebuilds
 * notifications); anything else dated today still rebuilds (evening nudge skips a logged day). Never throws.
 */
export async function checkOverspendForNewTransaction(input: CreateTransactionInput): Promise<void> {
  try {
    // The spending-jump check compares this month to last month, so a backdated entry (January logged in
    // September) would compare the wrong month and could pop a bogus alert.
    const today = toLocalIsoDate(new Date());
    const isCurrentMonth = input.date.slice(0, 7) === today.slice(0, 7);
    if (input.type === 'expense' && input.categoryId && isCurrentMonth) {
      await queueSpendAlerts(input.categoryId).catch(() => {});
    } else if (input.date === today) {
      await rebuildNotifications();
    }
  } catch (e) {
    // The entry is already committed: a notification hiccup must never be reported as a failed save (or, for a
    // recurring rule, deactivate it).
    console.warn('Post-save notification check failed:', e);
  }
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  await assertValidTransactionInput(input);
  const db = await getDb();
  const id = await insertTransactionRow(db, input);
  const row = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  await checkOverspendForNewTransaction(input);
  return rowToTransaction(found(row, 'entry'));
}

export async function listTransactions(filters?: {
  accountId?: string;
  categoryId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  /**
   * With `categoryId`, also match its subcategories: the same rollup Reports' "Where it went" totals use, so a
   * category's list is exactly what its total was built from. No-op without subcategories.
   */
  includeSubcategories?: boolean;
}): Promise<Transaction[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const args: SqlParam[] = [];

  if (filters?.accountId) {
    clauses.push('(account_id = ? OR to_account_id = ?)');
    args.push(filters.accountId, filters.accountId);
  }
  if (filters?.categoryId && filters.includeSubcategories) {
    clauses.push('(category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?))');
    args.push(filters.categoryId, filters.categoryId);
  } else if (filters?.categoryId) {
    clauses.push('category_id = ?');
    args.push(filters.categoryId);
  }
  if (filters?.fromDate) {
    clauses.push('date >= ?');
    args.push(filters.fromDate);
  }
  if (filters?.toDate) {
    clauses.push('date <= ?');
    args.push(filters.toDate);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  // A NaN limit (e.g. from parseInt('')) interpolated into the query gave "LIMIT NaN", a SQLite syntax error:
  // parameterized like other values, and omitted unless a valid positive integer.
  const hasLimit = Number.isFinite(filters?.limit) && (filters?.limit as number) > 0;
  if (hasLimit) args.push(Math.floor(filters!.limit as number));
  const rows = await db.getAllAsync<TransactionRow>(
    // A split part carries its whole payment's total, for "Part of a ₹1,850 split".
    `SELECT t.*,
       (SELECT SUM(s.amount_minor) FROM transactions s WHERE s.split_id = t.split_id) AS split_total_minor
     FROM transactions t ${where} ORDER BY date DESC, (day_rank IS NOT NULL) ASC, day_rank ASC, created_at DESC ${hasLimit ? 'LIMIT ?' : ''}`,
    args
  );
  return rows.map(rowToTransaction);
}

/**
 * Most-used amounts for a category in the last 90 days (Add's quick-pick). Ranked by how often an exact amount
 * recurs, not recency, so repeats beat a recent one-off; ties go to the latest. 90 days sheds old habits.
 */
export async function getFrequentAmountsForCategory(
  categoryId: string,
  limit = 4,
  today: string = toLocalIsoDate(new Date())
): Promise<number[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const since = addDaysToIsoDate(today, -90);
  // Same currency scoping as every other aggregate (see getPeriodSummary): without the accounts join, a
  // foreign-currency transaction would rank among default-currency ones with its face value mislabeled.
  const rows = await db.getAllAsync<{ amount_minor: number }>(
    `SELECT t.amount_minor as amount_minor, COUNT(*) as freq, MAX(t.date) as lastDate
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.category_id = ? AND a.currency = ? AND t.date >= ? AND t.date <= ?
     GROUP BY t.amount_minor
     ORDER BY freq DESC, lastDate DESC, t.amount_minor ASC
     LIMIT ?`,
    [categoryId, currency, since, today, limit]
  );
  return rows.map((r) => r.amount_minor);
}

/**
 * The account most recently used with a category, if any: Add picks it as the default once a category is
 * chosen. Archived accounts are skipped.
 */
export async function getLastAccountForCategory(categoryId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ account_id: string }>(
    `SELECT t.account_id AS account_id
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.category_id = ? AND a.archived = 0
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT 1`,
    [categoryId]
  );
  return row?.account_id ?? null;
}

/** How long after saving an entry an identical one counts as a possible repeat. */
export const REPEAT_WINDOW_MINUTES = 30;

/** `created_at`'s own format: UTC, "YYYY-MM-DD HH:MM:SS" (SQLite's datetime('now')). */
function toSqliteUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * An identical entry (type, account(s), category, amount, date) saved within REPEAT_WINDOW_MINUTES, or null;
 * returns its ISO save time. Add asks "add it anyway?": a double tap or forgotten entry is the usual cause.
 */
export async function findRecentRepeat(
  input: {
    type: TransactionType;
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
    amountMinor: number;
    date: string;
  },
  now: Date = new Date()
): Promise<{ savedAt: string } | null> {
  const db = await getDb();
  const since = toSqliteUtc(new Date(now.getTime() - REPEAT_WINDOW_MINUTES * 60_000));
  const row = await db.getFirstAsync<{ created_at: string }>(
    `SELECT created_at FROM transactions
     WHERE type = ? AND account_id = ? AND IFNULL(to_account_id, '') = ? AND IFNULL(category_id, '') = ?
       AND amount_minor = ? AND date = ? AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [
      input.type,
      input.accountId,
      input.toAccountId ?? '',
      input.categoryId ?? '',
      input.amountMinor,
      input.date,
      since,
    ]
  );
  return row ? { savedAt: `${row.created_at.replace(' ', 'T')}Z` } : null;
}

/**
 * Cross-period search: each word must match note, category name or account (either transfer side);
 * numbers also match the amount, a day ("24 sep") the date (parseSearchQuery). Deliberately not period-scoped.
 */
export async function searchTransactions(
  query: string,
  limit = 50,
  today: string = toLocalIsoDate(new Date())
): Promise<Transaction[]> {
  const { date, words } = parseSearchQuery(query, today);
  if (!date && words.length === 0) return [];
  const db = await getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (date) {
    clauses.push('t.date = ?');
    params.push(date);
  }
  for (const word of words) {
    // `%` and `_` are SQL LIKE wildcards: unescaped, searching a literal "50%" would match "50" followed by
    // anything (silent over-matching).
    const like = `%${word.text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const text = `t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR pc.name LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\' OR ta.name LIKE ? ESCAPE '\\'`;
    if (word.amountMinor) {
      clauses.push(`(${text} OR t.amount_minor BETWEEN ? AND ?)`);
      params.push(like, like, like, like, like, word.amountMinor.min, word.amountMinor.max);
    } else {
      clauses.push(`(${text})`);
      params.push(like, like, like, like, like);
    }
  }
  const cappedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT t.* FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT ?`,
    [...params, cappedLimit]
  );
  return rows.map(rowToTransaction);
}

export interface RepeatEntry {
  type: 'expense' | 'income';
  accountId: string;
  accountCurrency: string;
  categoryId: string;
  categoryName: string;
  /** The parent's name when the category is a subcategory, so same-named children can be told apart. */
  parentName: string | null;
  categoryIcon: string;
  categoryColor: string;
  amountMinor: number;
  /** The note from the most recent occurrence, '' if it had none. */
  note: string;
  timesLogged: number;
}

/**
 * Entries (type, account, category, amount) hand-logged 2+ times in 90 days, most repeated first (Log again).
 * Skips loan/friend and built-in-category entries (mis-filed), recurring-rule ones (double), archived/savings.
 */
export async function getRepeatEntries(
  limit = 3,
  today: string = toLocalIsoDate(new Date()),
  type?: 'expense' | 'income'
): Promise<RepeatEntry[]> {
  const db = await getDb();
  const since = addDaysToIsoDate(today, -90);
  // `t.note` is a bare column next to the single MAX(): SQLite takes it from
  // that same row, i.e. the most recent occurrence's note.
  const rows = await db.getAllAsync<{
    type: 'expense' | 'income';
    account_id: string;
    currency: string;
    category_id: string;
    category_name: string;
    parent_name: string | null;
    category_icon: string;
    category_color: string;
    amount_minor: number;
    freq: number;
    last_key: string;
    note: string;
  }>(
    `SELECT t.type AS type, t.account_id AS account_id, a.currency AS currency,
       t.category_id AS category_id, c.name AS category_name, pc.name AS parent_name, c.icon AS category_icon, c.color AS category_color,
       t.amount_minor AS amount_minor, COUNT(*) AS freq,
       MAX(t.date || ' ' || t.created_at) AS last_key, t.note AS note
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type IN ('expense', 'income') AND (? IS NULL OR t.type = ?) AND t.loan_id IS NULL AND t.is_refund = 0
       AND c.archived = 0 AND c.is_system = 0 AND a.archived = 0 AND a.type != 'savings'
       AND t.date >= ? AND t.date <= ?
       AND NOT EXISTS (SELECT 1 FROM loan_payments lp WHERE lp.transaction_id = t.id)
       AND NOT EXISTS (SELECT 1 FROM person_ledger_entries pe WHERE pe.transaction_id = t.id)
       AND NOT EXISTS (
         SELECT 1 FROM recurring_rules r
         WHERE r.active = 1 AND r.type = t.type AND r.account_id = t.account_id
           AND r.category_id = t.category_id AND r.amount_minor = t.amount_minor
       )
     GROUP BY t.type, t.account_id, t.category_id, t.amount_minor
     HAVING COUNT(*) >= 2
     ORDER BY freq DESC, last_key DESC
     LIMIT ?`,
    [type ?? null, type ?? null, since, today, limit]
  );
  return rows.map((r) => ({
    type: r.type,
    accountId: r.account_id,
    accountCurrency: r.currency,
    categoryId: r.category_id,
    categoryName: r.category_name,
    parentName: r.parent_name,
    categoryIcon: r.category_icon,
    categoryColor: r.category_color,
    amountMinor: r.amount_minor,
    note: r.note ?? '',
    timesLogged: r.freq,
  }));
}

/** How many transactions exist at all — a cheap COUNT for UI that only needs "is there real data yet". */
export async function countTransactions(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions');
  return row?.n ?? 0;
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  return row ? rowToTransaction(row) : null;
}

export interface UpdateTransactionInput {
  type: TransactionType;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amountMinor: number;
  date: string;
  note?: string;
  paymentMode?: PaymentMode | null;
  /** Money back for a purchase. Omitted keeps what the entry was; a non-income type is never a refund. */
  isRefund?: boolean;
}

/**
 * Edits a plain transaction's own fields. Never call on one linked to a loan payment or person ledger entry
 * (check getTransactionLink): use the loan/person "undo" flow, or the schedule/balance desyncs.
 */
export async function updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
  assertRealDate(input.date);
  if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive number');
  }
  if (input.amountMinor > MAX_AMOUNT_MINOR) {
    throw new Error('That amount is too large');
  }
  if (input.type === 'transfer' && !input.toAccountId) {
    throw new Error('Transfer requires a destination account');
  }
  if (input.type === 'transfer' && input.toAccountId === input.accountId) {
    throw new Error('Cannot transfer to the same account');
  }
  if (input.type !== 'transfer' && !input.categoryId) {
    throw new Error('Income/expense requires a category');
  }
  await assertSpendableAccount(input.type, input.accountId);
  await assertSameCurrencyTransfer(input.type, input.accountId, input.toAccountId);

  const db = await getDb();
  const current = await db.getFirstAsync<{ is_refund: number }>(
    'SELECT is_refund FROM transactions WHERE id = ?',
    [id]
  );
  // Only money in can be a refund: changing its type clears the flag.
  const isRefund = input.type === 'income' && (input.isRefund ?? !!current?.is_refund);
  if (isRefund) await assertRefundTarget(input.type, input.categoryId);
  // `paymentMode` omitted = leave as-is: the edit screen has no such field, so `?? null` would wipe the mode
  // a recurring rule stamped on the transaction.
  const keepPaymentMode = input.paymentMode === undefined;
  await db.runAsync(
    `UPDATE transactions
     SET type = ?, account_id = ?, to_account_id = ?, category_id = ?, amount_minor = ?, date = ?, note = ?, is_refund = ?, day_rank = CASE WHEN date = ? THEN day_rank END${
       keepPaymentMode ? '' : ', payment_mode = ?'
     }
     WHERE id = ?`,
    [
      input.type,
      input.accountId,
      input.toAccountId ?? null,
      input.categoryId ?? null,
      input.amountMinor,
      input.date,
      input.note ?? '',
      isRefund ? 1 : 0,
      input.date,
      ...(keepPaymentMode ? [] : [input.paymentMode ?? null]),
      id,
    ]
  );
  const row = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  return rowToTransaction(found(row, 'entry'));
}

/**
 * Saves a hand-arranged day: `orderedIds` are that day's entries top to bottom.
 * Only rows really dated `date` are touched, so a stale id can't rank another day.
 */
export async function setDayOrder(date: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.runAsync('UPDATE transactions SET day_rank = ? WHERE id = ? AND date = ?', [
        i,
        orderedIds[i],
        date,
      ]);
    }
  });
}

export type TransactionLink =
  | { kind: 'loan'; loanPaymentId: string } // an EMI payment — undoInstallmentPayment reverses it
  | { kind: 'person' } // a Friends & Family entry — undoPersonTransaction reverses it
  | { kind: 'loan-unlinked' } // a loan disbursement or prepayment — no undo exists yet, block editing
  | null;

/**
 * Whether this is the cash side of a loan or Friends & Family entry (and which), so callers route to its undo.
 * EMIs link via loan_payments.transaction_id; disbursement/fee/prepayment rows via loan_id and can't be edited.
 */
export async function getTransactionLink(id: string): Promise<TransactionLink> {
  return transactionLinkOn(await getDb(), id);
}

/** getTransactionLink on a given handle, so deleteTransaction can run it inside its own transaction (reads run one at a time: a transaction handle can't take parallel ones). */
async function transactionLinkOn(db: AppDb, id: string): Promise<TransactionLink> {
  const loanRow = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM loan_payments WHERE transaction_id = ?',
    [id]
  );
  const personRow = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM person_ledger_entries WHERE transaction_id = ?',
    [id]
  );
  const own = await db.getFirstAsync<{ loan_id: string | null }>(
    'SELECT loan_id FROM transactions WHERE id = ?',
    [id]
  );
  if (loanRow) return { kind: 'loan', loanPaymentId: loanRow.id };
  if (personRow) return { kind: 'person' };
  if (own?.loan_id) return { kind: 'loan-unlinked' };
  return null;
}

/**
 * Deletes a plain transaction; refuses loan-payment/person-linked ones (FKs are ON DELETE SET NULL, so a raw
 * delete would orphan the "paid" status or skew a balance). Use undoInstallmentPayment / undoPersonTransaction.
 */
/**
 * Deletes an entry and keeps it in Recently deleted for 30 days. `{ keep: false }` is for taking back an add a
 * moment ago ("Log again" Undo), which isn't worth finding later.
 */
export async function deleteTransaction(
  id: string,
  { keep = true }: { keep?: boolean } = {}
): Promise<RowSnapshot> {
  const db = await getDb();
  let snapshot: RowSnapshot | null = null;
  // Link check, capture and delete share one transaction, so the snapshot is exactly the row deleted and a
  // double-tap can't capture a row the other call is deleting.
  await db.withTransactionAsync(async (tx) => {
    if ((await transactionLinkOn(tx, id)) !== null) {
      throw new Error('This transaction is linked to a loan or person entry — undo it from there instead.');
    }
    const captured = await captureRow(tx, 'transactions', id);
    if (!captured) throw new Error('This transaction is already deleted.');
    // One part alone would leave half a payment behind; a split is deleted whole (db/splits.ts).
    if (captured.row.split_id) throw new Error('This is part of a split. Delete the whole split instead.');
    await tx.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
    if (keep) await keepDeletedEntry(tx, captured);
    snapshot = captured;
  });
  return snapshot as unknown as RowSnapshot;
}

/** Undoes `deleteTransaction` — re-inserts the exact row, never a fresh one, and takes it off Recently deleted. */
export async function restoreTransaction(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await restoreRow(tx, snapshot);
    await forgetDeletedEntry(tx, String(snapshot.row.id));
  });
}
