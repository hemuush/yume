import { getDb } from './client';
import { newId } from '@/lib/id';
import {
  getDefaultCurrency,
  getNotificationPrefs,
  getLastOverspendNotified,
  setLastOverspendNotified,
} from './settings';
import { Account, Category, Transaction, TransactionType, PaymentMode } from '@/types';
import { notifyOverspend } from '@/lib/notifications';
import { getPeriodComparison, findTopGrowingCategory } from './reports';
import { toLocalIsoDate } from '@/lib/date';

/**
 * After an expense is recorded, checks whether that category's spend this
 * month has grown well past its total for the prior month and, if so, fires
 * an immediate local notification — a check done once at the moment spend
 * actually changes, rather than a periodic background poll.
 */
export async function checkOverspendAndNotify(categoryId: string): Promise<void> {
  const prefs = await getNotificationPrefs();
  if (!prefs.overspendAlerts) return;

  // getPeriodComparison's categoryBreakdown is rolled up to top-level
  // categories (a subcategory's spend is folded into its parent's row) —
  // resolving the transaction's own category to its top-level ancestor
  // here too, otherwise a subcategory-tagged expense (e.g. "Zomato") could
  // never match `top.categoryId` (always a parent id like "Food & Dining")
  // and this alert would silently stop firing for anything tagged with a
  // subcategory.
  const db = await getDb();
  const row = await db.getFirstAsync<{ parent_id: string | null }>(
    'SELECT parent_id FROM categories WHERE id = ?',
    [categoryId]
  );
  const topLevelCategoryId = row?.parent_id ?? categoryId;

  const comparison = await getPeriodComparison('month');
  const top = findTopGrowingCategory(
    comparison.current.categoryBreakdown,
    comparison.previous.categoryBreakdown
  );
  if (!top || top.categoryId !== topLevelCategoryId) return;

  // Without this, the same category being "this month's top grower" fires a
  // fresh notification after every single transaction logged anywhere that
  // month — a real user reported this as spam. One alert per category per
  // calendar month is enough to be useful without being noisy.
  const monthKey = `${topLevelCategoryId}:${toLocalIsoDate(new Date()).slice(0, 7)}`;
  if ((await getLastOverspendNotified()) === monthKey) return;

  await notifyOverspend(top.name, top.pctChange);
  await setLastOverspendNotified(monthKey);
}

// Account balance is always DERIVED from opening_balance + ledger entries,
// never stored/mutated directly. This guarantees a balance can never drift
// out of sync with the transactions that produced it.
export async function getAccountBalance(accountId: string): Promise<number> {
  const db = await getDb();
  const account = await db.getFirstAsync<{ opening_balance_minor: number }>(
    'SELECT opening_balance_minor FROM accounts WHERE id = ?',
    [accountId]
  );
  if (!account) throw new Error(`Account ${accountId} not found`);

  const inflow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount_minor) as total FROM transactions
     WHERE (type = 'income' AND account_id = ?)
        OR (type = 'transfer' AND to_account_id = ?)`,
    [accountId, accountId]
  );
  const outflow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount_minor) as total FROM transactions
     WHERE (type = 'expense' AND account_id = ?)
        OR (type = 'transfer' AND account_id = ?)`,
    [accountId, accountId]
  );

  return account.opening_balance_minor + (inflow?.total ?? 0) - (outflow?.total ?? 0);
}

function rowToAccount(row: any): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    openingBalanceMinor: row.opening_balance_minor,
    currentBalanceMinor: row.current_balance_minor ?? row.opening_balance_minor,
    creditLimitMinor: row.credit_limit_minor,
    statementDay: row.statement_day,
    dueDay: row.due_day,
    interestRateAnnualBp: row.interest_rate_annual_bp,
    archived: !!row.archived,
    createdAt: row.created_at,
  };
}

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM accounts ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY created_at ASC`
  );
  const accounts = rows.map(rowToAccount);
  for (const acc of accounts) {
    acc.currentBalanceMinor = await getAccountBalance(acc.id);
  }
  return accounts;
}

export async function createAccount(input: {
  name: string;
  type: Account['type'];
  currency?: string;
  openingBalanceMinor?: number;
  creditLimitMinor?: number | null;
  statementDay?: number | null;
  dueDay?: number | null;
  interestRateAnnualBp?: number | null;
}): Promise<Account> {
  if (!input.name.trim()) {
    throw new Error('Account name is required');
  }
  const db = await getDb();
  const id = newId();
  const currency = input.currency ?? (await getDefaultCurrency());
  await db.runAsync(
    `INSERT INTO accounts
      (id, name, type, currency, opening_balance_minor, credit_limit_minor, statement_day, due_day, interest_rate_annual_bp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.type,
      currency,
      input.openingBalanceMinor ?? 0,
      input.creditLimitMinor ?? null,
      input.statementDay ?? null,
      input.dueDay ?? null,
      input.interestRateAnnualBp ?? null,
    ]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM accounts WHERE id = ?', [id]);
  return rowToAccount(row);
}

export interface UpdateAccountInput {
  name: string;
  type: Account['type'];
  openingBalanceMinor: number;
  creditLimitMinor?: number | null;
}

/**
 * Edits an account's own fields. Currency is deliberately not editable here
 * — every past transaction's amount is stored in minor units with no
 * currency conversion, so changing it after any transaction exists would
 * silently misrepresent every historical figure. Opening balance IS safe to
 * edit any time: the current balance is always derived (opening + ledger
 * entries), so correcting a wrong starting figure just shifts the derived
 * balance, exactly as intended.
 */
export async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
  if (!input.name.trim()) {
    throw new Error('Account name is required');
  }
  if (!Number.isFinite(input.openingBalanceMinor)) {
    throw new Error('Opening balance must be a valid number');
  }
  if (
    input.creditLimitMinor != null &&
    (!Number.isFinite(input.creditLimitMinor) || input.creditLimitMinor < 0)
  ) {
    throw new Error('Credit limit must be a valid, non-negative number');
  }
  const db = await getDb();
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, opening_balance_minor = ?, credit_limit_minor = ? WHERE id = ?`,
    [input.name.trim(), input.type, input.openingBalanceMinor, input.creditLimitMinor ?? null, id]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM accounts WHERE id = ?', [id]);
  if (!row) throw new Error('Account not found');
  const account = rowToAccount(row);
  account.currentBalanceMinor = await getAccountBalance(id);
  return account;
}

/** How many transactions reference this account, either as the source or (for a transfer) the destination — the basis for offering Delete vs. Archive. */
export async function getAccountTransactionCount(accountId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) as total FROM transactions WHERE account_id = ? OR to_account_id = ?',
    [accountId, accountId]
  );
  return row?.total ?? 0;
}

/**
 * Hides an account from pickers and totals without touching its history —
 * for an account you've stopped using but that still has real transactions
 * against it, the same reasoning `archiveCategory` uses. Any loan whose
 * `linked_account_id` points here keeps working (that FK is ON DELETE SET
 * NULL only for a real delete, not affected by archiving at all).
 */
export async function archiveAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE accounts SET archived = 1 WHERE id = ?', [id]);
}

export async function unarchiveAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE accounts SET archived = 0 WHERE id = ?', [id]);
}

/**
 * Permanently removes an account — only for one that's never actually been
 * used (e.g. created by mistake, wrong type/currency picked at setup). An
 * account with any real transaction history must be archived instead: the
 * schema's own `ON DELETE RESTRICT` on `transactions.account_id` would
 * reject the raw delete anyway, but checking first here means the user gets
 * a clear explanation instead of a raw SQLite constraint error.
 */
export async function deleteAccount(id: string): Promise<void> {
  const count = await getAccountTransactionCount(id);
  if (count > 0) {
    throw new Error(
      `This account has ${count} transaction${count === 1 ? '' : 's'} against it — archive it instead of deleting, so its history stays intact.`
    );
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
}

function rowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    parentId: row.parent_id,
    icon: row.icon,
    color: row.color,
    archived: !!row.archived,
    sortOrder: row.sort_order,
    isSensitive: !!row.is_sensitive,
  };
}

export async function listCategories(includeArchived = false): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM categories ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY sort_order ASC`
  );
  return rows.map(rowToCategory);
}

/**
 * Only two levels are allowed — a subcategory can't itself have children.
 * Without this, "Food & Dining > Zomato > Lunch orders" would be possible to
 * create but nothing in the app (pickers, the Reports rollup) knows how to
 * render or aggregate a third level, so it would just silently misbehave
 * rather than being visibly rejected here.
 */
async function assertValidParent(
  db: Awaited<ReturnType<typeof getDb>>,
  parentId: string,
  kind: Category['kind'],
  selfId?: string
): Promise<void> {
  if (parentId === selfId) {
    throw new Error("A category can't be its own parent");
  }
  const parent = await db.getFirstAsync<any>('SELECT * FROM categories WHERE id = ?', [parentId]);
  if (!parent) throw new Error('Parent category not found');
  if (parent.parent_id) {
    throw new Error(
      'Subcategories can only be one level deep — pick a top-level category as the parent instead.'
    );
  }
  if (parent.kind !== kind) {
    throw new Error('A subcategory must be the same kind (income/expense) as its parent');
  }
}

export async function createCategory(input: {
  name: string;
  kind: Category['kind'];
  parentId?: string | null;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isSensitive?: boolean;
}): Promise<Category> {
  const db = await getDb();
  if (input.parentId) {
    await assertValidParent(db, input.parentId, input.kind);
  }
  const id = newId();
  await db.runAsync(
    `INSERT INTO categories (id, name, kind, parent_id, icon, color, sort_order, is_sensitive)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.kind,
      input.parentId ?? null,
      input.icon ?? 'tag',
      input.color ?? '#6366F1',
      input.sortOrder ?? 0,
      input.isSensitive ? 1 : 0,
    ]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM categories WHERE id = ?', [id]);
  return rowToCategory(row);
}

/**
 * Archiving a parent cascades to its subcategories — leaving "Zomato" active
 * while its parent "Food & Dining" disappears from every picker would leave
 * an orphaned subcategory nobody can find or pick again on purpose.
 */
export async function archiveCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', [id]);
    await tx.runAsync('UPDATE categories SET archived = 1 WHERE parent_id = ?', [id]);
  });
}

export async function unarchiveCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET archived = 0 WHERE id = ?', [id]);
}

export async function updateCategory(
  id: string,
  input: { name: string; icon: string; color: string; parentId?: string | null; isSensitive?: boolean }
): Promise<void> {
  const db = await getDb();
  const current = await db.getFirstAsync<any>('SELECT * FROM categories WHERE id = ?', [id]);
  if (!current) throw new Error('Category not found');
  // `parentId` omitted entirely means "leave it as-is" — every existing call
  // site predates re-parenting support and never passes it, so defaulting a
  // missing field to null here would silently strip the parent off every
  // plain name/icon/color edit. Same pattern for `isSensitive`.
  const nextParentId = input.parentId !== undefined ? input.parentId : current.parent_id;
  const nextIsSensitive = input.isSensitive !== undefined ? input.isSensitive : !!current.is_sensitive;
  if (nextParentId) {
    const hasChildren = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM categories WHERE parent_id = ? LIMIT 1',
      [id]
    );
    if (hasChildren) {
      throw new Error(
        "This category already has subcategories of its own — it can't also become a subcategory."
      );
    }
    await assertValidParent(db, nextParentId, current.kind, id);
  }
  await db.runAsync(
    'UPDATE categories SET name = ?, icon = ?, color = ?, parent_id = ?, is_sensitive = ? WHERE id = ?',
    [input.name, input.icon, input.color, nextParentId, nextIsSensitive ? 1 : 0, id]
  );
}

/**
 * Permanently removes a category — for one added by mistake or never used,
 * not for one with real history (archive that instead, same split as
 * `deleteAccount`/`deleteLoan`). Blocked whenever any transaction or
 * recurring rule — this category's own, or any of its subcategories' —
 * still references it:
 *   - `transactions.category_id` is `ON DELETE SET NULL`, but the table also
 *     has `CHECK (type = 'transfer' OR category_id IS NOT NULL)`, so a raw
 *     delete of an in-use category would fail with a bare SQL constraint
 *     error instead of a clear message — checked and blocked here first.
 *   - `recurring_rules.category_id` is also `ON DELETE SET NULL` with no
 *     such CHECK, so a raw delete would silently succeed at the DB level —
 *     but the next `runDueRecurringRules()` pass would then call
 *     `createTransaction` with a null categoryId for that rule and throw,
 *     uncaught, aborting that automatic run. Blocking here instead means
 *     the user reassigns/removes the rule first, on their own terms.
 * Once past both checks, deleting cascades to subcategories (verified
 * unused above) and any budgets (schema's own `ON DELETE CASCADE` —
 * harmless today since nothing creates budgets yet).
 */
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  const children = await db.getAllAsync<{ id: string }>('SELECT id FROM categories WHERE parent_id = ?', [
    id,
  ]);
  const idsToCheck = [id, ...children.map((c) => c.id)];
  const placeholders = idsToCheck.map(() => '?').join(', ');

  const txCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE category_id IN (${placeholders})`,
    idsToCheck
  );
  if ((txCount?.count ?? 0) > 0) {
    const n = txCount!.count;
    throw new Error(
      `This category has ${n} transaction${n === 1 ? '' : 's'} against it${children.length ? ' (including its subcategories)' : ''} — archive it instead, so its history stays intact.`
    );
  }

  const ruleCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM recurring_rules WHERE category_id IN (${placeholders})`,
    idsToCheck
  );
  if ((ruleCount?.count ?? 0) > 0) {
    const n = ruleCount!.count;
    throw new Error(
      `This category is used by ${n} recurring rule${n === 1 ? '' : 's'} — remove or reassign ${n === 1 ? 'it' : 'them'} first, so automatic entries don't break.`
    );
  }

  await db.runAsync('DELETE FROM categories WHERE id = ? OR parent_id = ?', [id, id]);
}

function parseTags(raw: string | null): string[] {
  // A malformed `tags` value (a future migration, a hand-edited DB, a
  // restored backup with a corrupted field) would otherwise throw inside
  // this row-mapper — and since it's always called from inside a
  // `rows.map(...)`, one bad row would crash the *entire* transaction list
  // rather than just that row losing its tags.
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    date: row.date,
    note: row.note,
    tags: parseTags(row.tags),
    paymentMode: row.payment_mode,
    loanPaymentId: row.loan_payment_id,
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
  tags?: string[];
  paymentMode?: PaymentMode | null;
  loanPaymentId?: string | null;
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
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

  const db = await getDb();
  const id = newId();
  await db.runAsync(
    `INSERT INTO transactions
      (id, type, account_id, to_account_id, category_id, amount_minor, date, note, tags, payment_mode, loan_payment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.accountId,
      input.toAccountId ?? null,
      input.categoryId ?? null,
      input.amountMinor,
      input.date,
      input.note ?? '',
      JSON.stringify(input.tags ?? []),
      input.paymentMode ?? null,
      input.loanPaymentId ?? null,
    ]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [id]);
  // The overspend check compares this month's spend to last month's — firing
  // it for a backdated entry (e.g. logging January while it's September)
  // would compare the wrong month entirely and could pop a bogus "overspend"
  // alert that has nothing to do with current spending.
  const isCurrentMonth = input.date.slice(0, 7) === toLocalIsoDate(new Date()).slice(0, 7);
  if (input.type === 'expense' && input.categoryId && isCurrentMonth) {
    await checkOverspendAndNotify(input.categoryId).catch(() => {});
  }
  return rowToTransaction(row);
}

export async function listTransactions(filters?: {
  accountId?: string;
  categoryId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<Transaction[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const args: any[] = [];

  if (filters?.accountId) {
    clauses.push('(account_id = ? OR to_account_id = ?)');
    args.push(filters.accountId, filters.accountId);
  }
  if (filters?.categoryId) {
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
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM transactions ${where} ORDER BY date DESC, created_at DESC ${hasLimit ? 'LIMIT ?' : ''}`,
    args
  );
  return rows.map(rowToTransaction);
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

  const db = await getDb();
  await db.runAsync(
    `UPDATE transactions
     SET type = ?, account_id = ?, to_account_id = ?, category_id = ?, amount_minor = ?, date = ?, note = ?, payment_mode = ?
     WHERE id = ?`,
    [
      input.type,
      input.accountId,
      input.toAccountId ?? null,
      input.categoryId ?? null,
      input.amountMinor,
      input.date,
      input.note ?? '',
      input.paymentMode ?? null,
      id,
    ]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [id]);
  return rowToTransaction(row);
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
export async function isLinkedTransaction(id: string): Promise<boolean> {
  return (await getTransactionLink(id)) !== null;
}

/**
 * Deletes a plain transaction. Refuses to delete one linked to a loan
 * payment or person ledger entry — those foreign keys are ON DELETE SET
 * NULL, so a raw delete would silently orphan the loan's "paid" status or
 * leave a person's balance including money that no longer moved. Use
 * undoInstallmentPayment / undoPersonTransaction for those instead.
 */
export async function deleteTransaction(id: string): Promise<void> {
  if (await isLinkedTransaction(id)) {
    throw new Error('This transaction is linked to a loan or person entry — undo it from there instead.');
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}
