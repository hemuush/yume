import { found } from './found';
import { TransactionRow } from './rows';
import { getDb, AppDb, SqlParam } from './client';
import { newId } from '@/lib/id';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { getDefaultCurrency } from './settings';
import { Transaction, TransactionType, PaymentMode } from '@/types';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { parseSearchQuery } from '@/lib/searchQuery';

import { checkOverspendAndNotify } from './spendAlerts';
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
 * Savings accounts aren't spendable in place — money has to move out via a
 * transfer before it can be logged as income or an expense. Enforced here
 * (not just in the account pickers) so every path that writes a transaction
 * — the add-transaction screen, recurring rules, friend ledger entries,
 * imports — is held to the same rule, regardless of what UI or lack of UI
 * produced the input.
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
 * A transfer moves the same stored number out of one account and into the
 * other — there's no exchange rate anywhere in the schema — so between two
 * accounts in different currencies it would silently turn ₹1,000 into
 * $1,000. Rejected until the app has real conversion support.
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

/**
 * Every check createTransaction applies before writing — shared with
 * runDueRecurringRules, which has to do its own insert inside a
 * transaction (see insertTransactionRow) but must hold each occurrence to
 * exactly the same rules a hand-typed entry gets.
 */
export async function assertValidTransactionInput(input: CreateTransactionInput): Promise<void> {
  if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive number');
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
 * The raw INSERT behind createTransaction, against whichever handle it's
 * given — the outer db, or a `tx` inside withTransactionAsync (calling
 * createTransaction there would queue behind the transaction itself and
 * deadlock). Does no validation; run assertValidTransactionInput first.
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

/** The post-write overspend check every new expense gets — see checkOverspendAndNotify. Never throws. */
export async function checkOverspendForNewTransaction(input: CreateTransactionInput): Promise<void> {
  // The overspend check compares this month's spend to last month's — firing
  // it for a backdated entry (e.g. logging January while it's September)
  // would compare the wrong month entirely and could pop a bogus "overspend"
  // alert that has nothing to do with current spending.
  const isCurrentMonth = input.date.slice(0, 7) === toLocalIsoDate(new Date()).slice(0, 7);
  if (input.type === 'expense' && input.categoryId && isCurrentMonth) {
    await checkOverspendAndNotify(input.categoryId).catch(() => {});
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
   * With `categoryId`, also match that category's subcategories — the same
   * rollup Reports' "Where it went" totals use, so tapping a category lists
   * exactly the transactions its total was built from. A no-op for a
   * category with no subcategories.
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
  // A non-numeric/NaN limit (e.g. from a stray parseInt('')) interpolated
  // straight into the query used to produce literal "LIMIT NaN", which
  // SQLite rejects with a syntax error — parameterized like every other
  // value here, and simply omitted if it isn't a valid positive integer.
  const hasLimit = Number.isFinite(filters?.limit) && (filters?.limit as number) > 0;
  if (hasLimit) args.push(Math.floor(filters!.limit as number));
  const rows = await db.getAllAsync<TransactionRow>(
    // A split part carries its whole payment's total, for "Part of a ₹1,850 split".
    `SELECT t.*,
       (SELECT SUM(s.amount_minor) FROM transactions s WHERE s.split_id = t.split_id) AS split_total_minor
     FROM transactions t ${where} ORDER BY date DESC, created_at DESC ${hasLimit ? 'LIMIT ?' : ''}`,
    args
  );
  return rows.map(rowToTransaction);
}

/**
 * The most-used amounts logged against a category recently — powers Add
 * Transaction's "frequent amounts" quick-pick row. Ranked by how often an
 * exact amount recurs (not by recency alone), so a genuinely repeated
 * figure ("₹150 for the metro card, every time") surfaces even if a
 * one-off bigger purchase happened more recently; ties break toward the
 * most recent. Scoped to the last 90 days so an old, since-abandoned habit
 * doesn't keep crowding out how the category is actually used now.
 */
export async function getFrequentAmountsForCategory(
  categoryId: string,
  limit = 4,
  today: string = toLocalIsoDate(new Date())
): Promise<number[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const since = addDaysToIsoDate(today, -90);
  // Same currency scoping every other aggregate in the app uses (see
  // getPeriodSummary's own comment) — without the accounts join, a
  // transaction logged against a foreign-currency account would rank
  // alongside default-currency ones and surface as a quick-pick chip
  // showing that face value mislabeled in the default currency.
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
 * The account most recently used with a category, if any — Add picks it as
 * the default account once a category is chosen (Food usually goes on the
 * same card). Archived accounts are skipped.
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
 * An identical entry saved in the last REPEAT_WINDOW_MINUTES — same type,
 * account(s), category, amount and date — or null. Add asks "add it
 * anyway?" before saving a second one, since a double tap or a forgotten
 * earlier entry is the usual reason for a same-day pair. Returns when that
 * earlier one was saved, as an ISO timestamp.
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
 * Cross-period search — each word of the query has to match the
 * transaction's note, its category's name, or either side of the account it
 * moved through (a transfer matches on either account); a word that's a
 * number ("184", "₹1,807") also matches that amount, and a day in the query
 * ("24 sep", "24/9") narrows it to that date (see parseSearchQuery).
 * Deliberately not scoped by period the way `listTransactions` is: the whole
 * point is finding something outside whatever week/month Activity has in view.
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
    // `%` and `_` are SQL LIKE wildcards — without escaping them, searching
    // for a literal "50%" (a plausible note, e.g. "50% off coupon") would
    // instead match "50" followed by anything, silently over-matching.
    const like = `%${word.text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const text = `t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\' OR ta.name LIKE ? ESCAPE '\\'`;
    if (word.amountMinor) {
      clauses.push(`(${text} OR t.amount_minor BETWEEN ? AND ?)`);
      params.push(like, like, like, like, word.amountMinor.min, word.amountMinor.max);
    } else {
      clauses.push(`(${text})`);
      params.push(like, like, like, like);
    }
  }
  const cappedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT t.* FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
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
  categoryIcon: string;
  categoryColor: string;
  amountMinor: number;
  /** The note from the most recent occurrence, '' if it had none. */
  note: string;
  timesLogged: number;
}

/**
 * The exact entries (same type, account, category and amount) the user has
 * logged by hand at least twice in the last 90 days, most repeated first —
 * the + button's long-press "Log again" list, and Add's "Your usual" chips
 * (one `type` at a time). Left out on purpose:
 *   - anything a loan or friend flow wrote (EMIs, disbursements, IOUs) or
 *     filed under a built-in category — logging those by hand mis-files them;
 *   - anything an active recurring rule already posts (rent, salary) — a
 *     one-tap repeat of those would double them;
 *   - archived categories/accounts and savings accounts, which can't take a
 *     new expense or income anyway.
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
    category_icon: string;
    category_color: string;
    amount_minor: number;
    freq: number;
    last_key: string;
    note: string;
  }>(
    `SELECT t.type AS type, t.account_id AS account_id, a.currency AS currency,
       t.category_id AS category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
       t.amount_minor AS amount_minor, COUNT(*) AS freq,
       MAX(t.date || ' ' || t.created_at) AS last_key, t.note AS note
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
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
 * Edits a plain transaction's own fields. Never call this on a transaction
 * linked to a loan payment or a person ledger entry (check first via
 * isLinkedTransaction) — those must go through the loan/person "undo" flow
 * instead, or their schedule/balance would silently desync from this edit.
 */
export async function updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
  if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive number');
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
  // `paymentMode` omitted means "leave it as-is": the edit screen has no
  // payment-mode field, so writing `?? null` here used to wipe the mode a
  // recurring rule had stamped on the transaction every time it was edited.
  const keepPaymentMode = input.paymentMode === undefined;
  await db.runAsync(
    `UPDATE transactions
     SET type = ?, account_id = ?, to_account_id = ?, category_id = ?, amount_minor = ?, date = ?, note = ?, is_refund = ?${
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
      ...(keepPaymentMode ? [] : [input.paymentMode ?? null]),
      id,
    ]
  );
  const row = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  return rowToTransaction(found(row, 'entry'));
}

export type TransactionLink =
  | { kind: 'loan'; loanPaymentId: string } // an EMI payment — undoInstallmentPayment reverses it
  | { kind: 'person' } // a Friends & Family entry — undoPersonTransaction reverses it
  | { kind: 'loan-unlinked' } // a loan disbursement or prepayment — no undo exists yet, block editing
  | null;

/**
 * Whether this transaction is the cash-side of a loan payment or a Friends
 * & Family ledger entry — and if so, which, so the caller can route to the
 * right "undo" flow instead of a raw edit/delete.
 *
 * EMI payments are found via loan_payments.transaction_id (a real FK link).
 * A loan's disbursement, processing fee, and prepayment (plus its charge)
 * transactions are found via transactions.loan_id instead — a real FK,
 * populated by every one of those inserts in db/loans.ts — and are blocked
 * from editing/deleting directly since no undo exists for any of them yet
 * (only whole-loan deletion, which cascades them away together).
 */
export async function getTransactionLink(id: string): Promise<TransactionLink> {
  const db = await getDb();
  const [loanRow, personRow, tx] = await Promise.all([
    db.getFirstAsync<{ id: string }>('SELECT id FROM loan_payments WHERE transaction_id = ?', [id]),
    db.getFirstAsync<{ id: string }>('SELECT id FROM person_ledger_entries WHERE transaction_id = ?', [id]),
    db.getFirstAsync<{ loan_id: string | null }>('SELECT loan_id FROM transactions WHERE id = ?', [id]),
  ]);
  if (loanRow) return { kind: 'loan', loanPaymentId: loanRow.id };
  if (personRow) return { kind: 'person' };
  if (tx?.loan_id) return { kind: 'loan-unlinked' };
  return null;
}

/** True if this transaction is the cash-side of a loan payment or a Friends & Family ledger entry. */
async function isLinkedTransaction(id: string): Promise<boolean> {
  return (await getTransactionLink(id)) !== null;
}

/**
 * Deletes a plain transaction. Refuses to delete one linked to a loan
 * payment or person ledger entry — those foreign keys are ON DELETE SET
 * NULL, so a raw delete would silently orphan the loan's "paid" status or
 * leave a person's balance including money that no longer moved. Use
 * undoInstallmentPayment / undoPersonTransaction for those instead.
 */
/**
 * Deletes an entry and keeps it in Recently deleted for 30 days. Pass
 * `{ keep: false }` when the delete only takes back an add a moment ago (the
 * Undo on "Log again"), which isn't something to find later.
 */
export async function deleteTransaction(
  id: string,
  { keep = true }: { keep?: boolean } = {}
): Promise<RowSnapshot> {
  if (await isLinkedTransaction(id)) {
    throw new Error('This transaction is linked to a loan or person entry — undo it from there instead.');
  }
  const db = await getDb();
  const snapshot = await captureRow(db, 'transactions', id);
  if (!snapshot) throw new Error('This transaction is already deleted.');
  // One part alone would leave half a payment behind; a split is deleted whole (db/splits.ts).
  if (snapshot.row.split_id) throw new Error('This is part of a split. Delete the whole split instead.');
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
    if (keep) await keepDeletedEntry(tx, snapshot);
  });
  return snapshot;
}

/** Undoes `deleteTransaction` — re-inserts the exact row, never a fresh one, and takes it off Recently deleted. */
export async function restoreTransaction(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await restoreRow(tx, snapshot);
    await forgetDeletedEntry(tx, String(snapshot.row.id));
  });
}
