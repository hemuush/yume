import { found } from './found';
import { AccountRow } from './rows';
import { getDb } from './client';
import { newId } from '@/lib/id';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { getDefaultCurrency } from './settings';
import { Account } from '@/types';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { isCycleDay } from '@/lib/cardCycle';

/** Accounts: balances (always derived from entries), create, edit, archive and delete (re-exported from ./ledger). */

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

/**
 * How much an account grew per month, on average, over the last `days`
 * days: money in (income, transfers in) less money out. What-if uses it as
 * the saving rate of a goal that follows the account. Never below zero —
 * an account that shrank isn't saving toward anything.
 */
export async function getAccountMonthlyGrowth(
  accountId: string,
  days = 90,
  today: string = toLocalIsoDate(new Date())
): Promise<number> {
  const db = await getDb();
  const since = addDaysToIsoDate(today, -days + 1);
  const row = await db.getFirstAsync<{ net: number | null }>(
    `SELECT SUM(CASE
       WHEN (type = 'income' AND account_id = ?) OR (type = 'transfer' AND to_account_id = ?) THEN amount_minor
       ELSE -amount_minor END) AS net
     FROM transactions
     WHERE date >= ? AND date <= ?
       AND ((type IN ('income', 'expense') AND account_id = ?)
         OR (type = 'transfer' AND (account_id = ? OR to_account_id = ?)))`,
    [accountId, accountId, since, today, accountId, accountId, accountId]
  );
  return Math.max(0, Math.round((row?.net ?? 0) / (days / 30.44)));
}

function rowToAccount(row: AccountRow & { current_balance_minor?: number | null }): Account {
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
  const rows = await db.getAllAsync<AccountRow & { current_balance_minor: number }>(
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

/** A card's statement and due days: both or neither, each a day of the month (1–31). */
function assertCycleDays(statementDay?: number | null, dueDay?: number | null): void {
  const s = statementDay ?? null;
  const d = dueDay ?? null;
  if ((s == null) !== (d == null))
    throw new Error('Set both the statement day and the bill due day, or neither');
  if (s != null && (!isCycleDay(s) || !isCycleDay(d!))) {
    throw new Error('Statement and due days are days of the month, from 1 to 31');
  }
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
  assertCycleDays(input.statementDay, input.dueDay);
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
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
  return rowToAccount(found(row, 'account'));
}

export interface UpdateAccountInput {
  name: string;
  type: Account['type'];
  openingBalanceMinor: number;
  creditLimitMinor?: number | null;
  /** A credit card's statement and bill due days (1–31); both or neither. Cleared for any other type. */
  statementDay?: number | null;
  dueDay?: number | null;
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
  assertCycleDays(input.statementDay, input.dueDay);
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
  const isCard = input.type === 'credit_card';
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, opening_balance_minor = ?, credit_limit_minor = ?, statement_day = ?, due_day = ? WHERE id = ?`,
    [
      input.name.trim(),
      input.type,
      input.openingBalanceMinor,
      input.creditLimitMinor ?? null,
      isCard ? (input.statementDay ?? null) : null,
      isCard ? (input.dueDay ?? null) : null,
      id,
    ]
  );
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
  if (!row) throw new Error('Account not found');
  const account = rowToAccount(row);
  account.currentBalanceMinor = await getAccountBalance(id);
  return account;
}

export interface AccountFlow {
  /** Everything in: income plus transfers in from your other accounts. */
  inMinor: number;
  /** Everything out: expenses plus transfers out to your other accounts. */
  outMinor: number;
  incomeMinor: number;
  transferInMinor: number;
  expenseMinor: number;
  transferOutMinor: number;
}

/**
 * Money into and out of one account over a date range (inclusive) — the
 * same four movements getAccountBalance sums, kept apart: income and
 * transfers in, expenses and transfers out. The split matters: an account
 * that mostly passes money between your own accounts (salary in, straight
 * on to savings) otherwise looks the same as one you spend from. In the
 * account's own currency, so unlike the report totals there's no
 * default-currency filter. Powers Home's account summary sheet.
 */
export async function getAccountFlow(
  accountId: string,
  range: { start: string; end: string }
): Promise<AccountFlow> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    income: number | null;
    transfer_in: number | null;
    expense: number | null;
    transfer_out: number | null;
  }>(
    `SELECT
       SUM(CASE WHEN type = 'income' AND account_id = ? THEN amount_minor ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'transfer' AND to_account_id = ? THEN amount_minor ELSE 0 END) AS transfer_in,
       SUM(CASE WHEN type = 'expense' AND account_id = ? THEN amount_minor ELSE 0 END) AS expense,
       SUM(CASE WHEN type = 'transfer' AND account_id = ? THEN amount_minor ELSE 0 END) AS transfer_out
     FROM transactions
     WHERE (account_id = ? OR to_account_id = ?) AND date >= ? AND date <= ?`,
    [accountId, accountId, accountId, accountId, accountId, accountId, range.start, range.end]
  );
  const incomeMinor = row?.income ?? 0;
  const transferInMinor = row?.transfer_in ?? 0;
  const expenseMinor = row?.expense ?? 0;
  const transferOutMinor = row?.transfer_out ?? 0;
  return {
    inMinor: incomeMinor + transferInMinor,
    outMinor: expenseMinor + transferOutMinor,
    incomeMinor,
    transferInMinor,
    expenseMinor,
    transferOutMinor,
  };
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
