import { getDb, AppDb } from './client';
import { newId } from '@/lib/id';
import { captureRow, captureRows, restoreRow, restoreRows, RowSnapshot } from './undoSnapshot';
import {
  getDefaultCurrency,
  getNotificationPrefs,
  getLastOverspendNotified,
  setLastOverspendNotified,
} from './settings';
import { Account, Category, Transaction, TransactionType, PaymentMode } from '@/types';
import { notifyOverspend } from '@/lib/notifications';
import { getPeriodComparison, findTopGrowingCategory } from './reports';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';

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
  // One query for every account's balance — the same derivation as
  // getAccountBalance (opening + income/transfers-in − expenses/transfers-out),
  // just grouped. It used to be two extra queries per account, each a
  // separate trip through the app-wide statement queue that every other
  // screen's loads wait behind.
  const rows = await db.getAllAsync<any>(
    `SELECT a.*,
       a.opening_balance_minor + COALESCE((
         SELECT SUM(CASE
             WHEN t.type = 'income' AND t.account_id = a.id THEN t.amount_minor
             WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount_minor
             WHEN t.type = 'expense' AND t.account_id = a.id THEN -t.amount_minor
             WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount_minor
             ELSE 0
           END)
         FROM transactions t
         WHERE t.account_id = a.id OR t.to_account_id = a.id
       ), 0) AS current_balance_minor
     FROM accounts a ${includeArchived ? '' : 'WHERE a.archived = 0'} ORDER BY a.created_at ASC`
  );
  return rows.map(rowToAccount);
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
  if (input.type === 'savings') {
    // Retyping an account that an active income/expense recurring rule still
    // points at would otherwise pass silently here and only surface much
    // later: the next runDueRecurringRules() pass hits assertSpendableAccount
    // inside createTransaction, throws, and the rule gets deactivated with
    // just a console.error — no visible reason to the user. Same reasoning
    // as deleteCategory's block below for recurring_rules.category_id.
    const blockingRule = await db.getFirstAsync<{ note: string | null }>(
      `SELECT note FROM recurring_rules WHERE account_id = ? AND type != 'transfer' AND active = 1 LIMIT 1`,
      [id]
    );
    if (blockingRule) {
      throw new Error(
        `A recurring rule${blockingRule.note ? ` ("${blockingRule.note}")` : ''} still posts income/expenses from this account — pause or reassign it first.`
      );
    }
  }
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
export async function deleteAccount(id: string): Promise<RowSnapshot> {
  const count = await getAccountTransactionCount(id);
  if (count > 0) {
    throw new Error(
      `This account has ${count} transaction${count === 1 ? '' : 's'} against it — archive it instead of deleting, so its history stays intact.`
    );
  }
  const db = await getDb();
  const snapshot = await captureRow(db, 'accounts', id);
  if (!snapshot) throw new Error('This account is already deleted.');
  await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
  return snapshot;
}

/** Undoes `deleteAccount` — re-inserts the exact row, never a fresh one. */
export async function restoreAccount(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await restoreRow(db, snapshot);
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
    isSystem: !!row.is_system,
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
  await assertNotSystemCategory(db, id, 'archived');
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', [id]);
    await tx.runAsync('UPDATE categories SET archived = 1 WHERE parent_id = ?', [id]);
  });
}

/**
 * The five seeded categories flagged `is_system` (Loan EMI, Loan Repayment,
 * Fees & Charges, Friends & Family income + expense) are looked up by name
 * at runtime to auto-file loan and Friends & Family transactions — deleting,
 * archiving, or renaming one silently breaks that match, so all three are
 * blocked here where every UI path funnels through.
 */
async function assertNotSystemCategory(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  action: 'deleted' | 'archived'
): Promise<void> {
  const row = await db.getFirstAsync<{ name: string; is_system: number }>(
    'SELECT name, is_system FROM categories WHERE id = ?',
    [id]
  );
  if (row?.is_system) {
    throw new Error(
      `"${row.name}" is a built-in category Yume uses to auto-categorise EMI, fees and Friends & Family entries — it can't be ${action}.`
    );
  }
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
  // A built-in category is matched by name at runtime — its icon, colour,
  // sensitivity and subcategories stay editable, but the name is fixed.
  if (current.is_system && input.name.trim() !== current.name) {
    throw new Error("The name of a built-in category can't be changed.");
  }
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
export async function deleteCategory(id: string): Promise<RowSnapshot[]> {
  const db = await getDb();
  await assertNotSystemCategory(db, id, 'deleted');
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

  // Sorted parent-first: `restoreCategory` re-inserts in this same order, and
  // a child row's `parent_id` foreign key needs its parent to already exist.
  const snapshots = (await captureRows(db, 'categories', 'id = ? OR parent_id = ?', [id, id])).sort((a, b) =>
    a.row.id === id ? -1 : b.row.id === id ? 1 : 0
  );
  await db.runAsync('DELETE FROM categories WHERE id = ? OR parent_id = ?', [id, id]);
  return snapshots;
}

/** Undoes `deleteCategory` — re-inserts the category (and any subcategories it took with it), in the same parent-first order they were captured. */
export async function restoreCategory(snapshots: RowSnapshot[]): Promise<void> {
  const db = await getDb();
  await restoreRows(db, snapshots);
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
  const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [id]);
  await checkOverspendForNewTransaction(input);
  return rowToTransaction(row);
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
  const args: any[] = [];

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
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM transactions ${where} ORDER BY date DESC, created_at DESC ${hasLimit ? 'LIMIT ?' : ''}`,
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
 * The categories of one kind the user actually logs against most, most
 * used first — powers Add Transaction's "Recent" row, so a habitual
 * expense is one tap instead of a hunt through the full grid. Same 90-day
 * window and frequency-then-recency ranking getFrequentAmountsForCategory
 * uses. Built-in system categories (Loan EMI, Friends & Family, Fees &
 * Charges) are left out: the app files those automatically from the loan
 * and friend flows, so suggesting them for a hand-typed entry would only
 * invite mis-filing. Archived categories are left out too.
 */
export async function getRecentCategoryIds(
  kind: Category['kind'],
  limit = 5,
  today: string = toLocalIsoDate(new Date())
): Promise<string[]> {
  const db = await getDb();
  const since = addDaysToIsoDate(today, -90);
  const rows = await db.getAllAsync<{ category_id: string }>(
    `SELECT t.category_id AS category_id, COUNT(*) AS freq, MAX(t.date) AS last_date
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE c.kind = ? AND c.archived = 0 AND c.is_system = 0
       AND t.date >= ? AND t.date <= ?
     GROUP BY t.category_id
     ORDER BY freq DESC, last_date DESC
     LIMIT ?`,
    [kind, since, today, limit]
  );
  return rows.map((r) => r.category_id);
}

/**
 * Cross-period text search — matches a transaction's own note, its
 * category's name, or either side of the account it moved through (a
 * transfer matches on either account). Deliberately not scoped by date the
 * way `listTransactions` is: the whole point is finding something outside
 * whatever week/month the Transactions screen currently has in view.
 */
export async function searchTransactions(query: string, limit = 50): Promise<Transaction[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const db = await getDb();
  // `%` and `_` are SQL LIKE wildcards — without escaping them, searching
  // for a literal "50%" (a plausible note, e.g. "50% off coupon") would
  // instead match "50" followed by anything, silently over-matching.
  const escaped = trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
  const like = `%${escaped}%`;
  const cappedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const rows = await db.getAllAsync<any>(
    `SELECT t.* FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id
     WHERE t.note LIKE ? ESCAPE '\\'
        OR c.name LIKE ? ESCAPE '\\'
        OR a.name LIKE ? ESCAPE '\\'
        OR ta.name LIKE ? ESCAPE '\\'
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT ?`,
    [like, like, like, like, cappedLimit]
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
 * the + button's long-press "Log again" list. Left out on purpose:
 *   - anything a loan or friend flow wrote (EMIs, disbursements, IOUs) or
 *     filed under a built-in category — logging those by hand mis-files them;
 *   - anything an active recurring rule already posts (rent, salary) — a
 *     one-tap repeat of those would double them;
 *   - archived categories/accounts and savings accounts, which can't take a
 *     new expense or income anyway.
 */
export async function getRepeatEntries(
  limit = 3,
  today: string = toLocalIsoDate(new Date())
): Promise<RepeatEntry[]> {
  const db = await getDb();
  const since = addDaysToIsoDate(today, -90);
  // `t.note` is a bare column next to the single MAX(): SQLite takes it from
  // that same row, i.e. the most recent occurrence's note.
  const rows = await db.getAllAsync<any>(
    `SELECT t.type AS type, t.account_id AS account_id, a.currency AS currency,
       t.category_id AS category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
       t.amount_minor AS amount_minor, COUNT(*) AS freq,
       MAX(t.date || ' ' || t.created_at) AS last_key, t.note AS note
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type IN ('expense', 'income') AND t.loan_id IS NULL
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
    [since, today, limit]
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
  const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [id]);
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
  // `paymentMode` omitted means "leave it as-is": the edit screen has no
  // payment-mode field, so writing `?? null` here used to wipe the mode a
  // recurring rule had stamped on the transaction every time it was edited.
  const keepPaymentMode = input.paymentMode === undefined;
  await db.runAsync(
    `UPDATE transactions
     SET type = ?, account_id = ?, to_account_id = ?, category_id = ?, amount_minor = ?, date = ?, note = ?${
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
      ...(keepPaymentMode ? [] : [input.paymentMode ?? null]),
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
export async function deleteTransaction(id: string): Promise<RowSnapshot> {
  if (await isLinkedTransaction(id)) {
    throw new Error('This transaction is linked to a loan or person entry — undo it from there instead.');
  }
  const db = await getDb();
  const snapshot = await captureRow(db, 'transactions', id);
  if (!snapshot) throw new Error('This transaction is already deleted.');
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  return snapshot;
}

/** Undoes `deleteTransaction` — re-inserts the exact row, never a fresh one. */
export async function restoreTransaction(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await restoreRow(db, snapshot);
}
