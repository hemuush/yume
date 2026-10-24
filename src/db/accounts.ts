import { found } from './found';
import { AccountRow } from './rows';
import { getDb, type AppDb } from './client';
import { newId } from '@/lib/id';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { getDefaultCurrency } from './settings';
import { Account, InvestmentKind } from '@/types';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { isCycleDay } from '@/lib/cardCycle';
import { ledgerFlowSql, valuationAdjSql, latestValuedAtSql, latestValueSql } from './valuationSql';
import { rebuildNotificationsAfterCommit } from './afterCommit';

/** Accounts: balances (always derived from entries), create, edit, archive and delete (re-exported from ./ledger). */

// Balance is always DERIVED from opening_balance + ledger entries, never stored,
// so it can't drift out of sync with the transactions behind it.
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

  const ledger = account.opening_balance_minor + (inflow?.total ?? 0) - (outflow?.total ?? 0);
  // A tracked account is worth its latest valuation plus what moved since.
  const adj = await db.getFirstAsync<{ adj: number }>(
    `SELECT ${valuationAdjSql('a')} AS adj FROM accounts a WHERE a.id = ?`,
    [accountId]
  );
  return ledger + (adj?.adj ?? 0);
}

/**
 * Average monthly growth over the last `days` days (money in less money out); What-if's saving rate
 * for a goal that follows the account. Never below zero: a shrinking account isn't saving.
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

/** The extra columns listAccounts selects (investment ones are null for an untracked account). */
interface BalanceColumns {
  current_balance_minor?: number | null;
  inv_adj?: number | null;
  inv_income?: number | null;
  inv_expense?: number | null;
  inv_in?: number | null;
  inv_out?: number | null;
  inv_valued_at?: string | null;
  inv_last_value?: number | null;
}

function rowToAccount(row: AccountRow & BalanceColumns): Account {
  const ledger = row.current_balance_minor ?? row.opening_balance_minor;
  const tracked = !!row.tracked;
  const adj = row.inv_adj ?? 0;
  const account: Account = {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    openingBalanceMinor: row.opening_balance_minor,
    currentBalanceMinor: ledger + (tracked ? adj : 0),
    creditLimitMinor: row.credit_limit_minor,
    statementDay: row.statement_day,
    dueDay: row.due_day,
    interestRateAnnualBp: row.interest_rate_annual_bp,
    minDueBp: row.min_due_bp ?? null,
    minDueFloorMinor: row.min_due_floor_minor ?? null,
    archived: !!row.archived,
    createdAt: row.created_at,
  };
  if (tracked) {
    const valuedAt = row.inv_valued_at ?? null;
    account.investment = {
      investedMinor: row.opening_balance_minor + (row.inv_in ?? 0),
      takenOutMinor: row.inv_out ?? 0,
      // value + taken out − invested, i.e. the valuation's gap plus income less expenses.
      gainMinor: valuedAt ? adj + (row.inv_income ?? 0) - (row.inv_expense ?? 0) : null,
      valuedAt,
      lastValueMinor: valuedAt ? (row.inv_last_value ?? null) : null,
      kind: (row.investment_kind as InvestmentKind | null) ?? null,
      fundingAccountId: row.funding_account_id ?? null,
      units: row.units ?? null,
      maturityDate: row.maturity_date ?? null,
    };
  }
  return account;
}

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const db = await getDb();
  // One grouped query for all balances (as getAccountBalance), not per-account queries in the shared queue.
  // CASE selects investment columns (valuation gap, in/out, latest update) only for tracked accounts.
  const flowSum = (when: string) =>
    `CASE WHEN a.tracked = 1 THEN COALESCE((SELECT SUM(${when}) FROM transactions t
       WHERE t.account_id = a.id OR t.to_account_id = a.id), 0) END`;
  const rows = await db.getAllAsync<AccountRow & BalanceColumns>(
    `SELECT a.*,
       a.opening_balance_minor + ${ledgerFlowSql('a')} AS current_balance_minor,
       ${valuationAdjSql('a')} AS inv_adj,
       ${flowSum(`CASE WHEN t.type = 'income' AND t.account_id = a.id THEN t.amount_minor ELSE 0 END`)} AS inv_income,
       ${flowSum(`CASE WHEN t.type = 'expense' AND t.account_id = a.id THEN t.amount_minor ELSE 0 END`)} AS inv_expense,
       ${flowSum(`CASE WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount_minor ELSE 0 END`)} AS inv_in,
       ${flowSum(`CASE WHEN t.type = 'transfer' AND t.account_id = a.id THEN t.amount_minor ELSE 0 END`)} AS inv_out,
       CASE WHEN a.tracked = 1 THEN ${latestValuedAtSql('a')} END AS inv_valued_at,
       CASE WHEN a.tracked = 1 THEN ${latestValueSql('a')} END AS inv_last_value
     FROM accounts a ${includeArchived ? '' : 'WHERE a.archived = 0'} ORDER BY a.created_at ASC`
  );
  return rows.map(rowToAccount);
}

const INVESTMENT_KINDS: readonly InvestmentKind[] = [
  'mutual_fund',
  'stocks',
  'gold',
  'fixed_deposit',
  'ppf_epf',
  'other',
];

/**
 * What an investment's kind and funding account are allowed to be. Neither means anything on an account that is
 * not an investment, so both clear there. Funding must be a plain spendable account of the same currency (a
 * transfer cannot cross currencies), never the investment itself, a card or another investment.
 */
async function resolveInvestmentLinks(
  db: AppDb,
  accountId: string | null,
  currency: string,
  isInvestment: boolean,
  kind: InvestmentKind | null | undefined,
  fundingAccountId: string | null | undefined
): Promise<{ kind: InvestmentKind | null; fundingAccountId: string | null }> {
  if (!isInvestment) return { kind: null, fundingAccountId: null };
  if (kind != null && !INVESTMENT_KINDS.includes(kind)) throw new Error('Choose a valid kind of investment.');
  if (fundingAccountId == null) return { kind: kind ?? null, fundingAccountId: null };
  if (fundingAccountId === accountId) throw new Error('An investment cannot be paid from itself.');
  const funding = await db.getFirstAsync<{ type: string; currency: string; tracked: number }>(
    'SELECT type, currency, tracked FROM accounts WHERE id = ?',
    [fundingAccountId]
  );
  if (!funding) throw new Error('That funding account no longer exists.');
  if (funding.type === 'credit_card' || funding.tracked)
    throw new Error('Choose a bank, cash or wallet account to pay from.');
  if (funding.currency !== currency)
    throw new Error(`Money can only come from an account in ${currency}, the same as this investment.`);
  return { kind: kind ?? null, fundingAccountId };
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

function assertMinDue(bp: number | null | undefined, floor: number | null | undefined) {
  if (bp != null && (!Number.isSafeInteger(bp) || bp < 0 || bp > 10000))
    throw new Error('Minimum due must be between 0% and 100% of the statement');
  if (floor != null && (!Number.isSafeInteger(floor) || floor < 0))
    throw new Error('Minimum due floor must be a valid, non-negative whole number');
}

function assertHolding(
  units: number | null | undefined,
  rateBp: number | null | undefined,
  maturityDate: string | null | undefined
) {
  if (units != null && (!Number.isFinite(units) || units < 0)) throw new Error('Units must be zero or more');
  if (rateBp != null && (!Number.isSafeInteger(rateBp) || rateBp < 0 || rateBp > 10000))
    throw new Error('Yearly rate must be between 0% and 100%');
  if (maturityDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(maturityDate))
    throw new Error('Maturity date must be a date');
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
  /** A savings account whose value you update by hand (an investment). Ignored for any other type. */
  tracked?: boolean;
  /** An investment's kind; ignored unless tracked. */
  investmentKind?: InvestmentKind | null;
  /** The account an investment's money normally comes from; ignored unless tracked. */
  fundingAccountId?: string | null;
  /** A credit card's minimum due: basis points of the statement, and the least it can be. */
  minDueBp?: number | null;
  minDueFloorMinor?: number | null;
  /** A tracked account's units, yearly rate (basis points) and maturity date. */
  units?: number | null;
  rateBp?: number | null;
  maturityDate?: string | null;
}): Promise<Account> {
  if (!input.name.trim()) {
    throw new Error('Account name is required');
  }
  if (!Number.isSafeInteger(input.openingBalanceMinor ?? 0))
    throw new Error('Opening balance must be a valid whole number');
  if (
    input.creditLimitMinor != null &&
    (!Number.isSafeInteger(input.creditLimitMinor) || input.creditLimitMinor < 0)
  )
    throw new Error('Credit limit must be a valid, non-negative whole number');
  assertCycleDays(input.statementDay, input.dueDay);
  assertMinDue(input.minDueBp, input.minDueFloorMinor);
  assertHolding(input.units, input.rateBp, input.maturityDate);
  const db = await getDb();
  const id = newId();
  const currency = input.currency ?? (await getDefaultCurrency());
  const isInvestment = input.type === 'savings' && !!input.tracked;
  const links = await resolveInvestmentLinks(
    db,
    null,
    currency,
    isInvestment,
    input.investmentKind,
    input.fundingAccountId
  );
  await db.runAsync(
    `INSERT INTO accounts
      (id, name, type, currency, opening_balance_minor, credit_limit_minor, statement_day, due_day, interest_rate_annual_bp, tracked, investment_kind, funding_account_id, min_due_bp, min_due_floor_minor, units, maturity_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.type,
      currency,
      input.openingBalanceMinor ?? 0,
      input.creditLimitMinor ?? null,
      input.statementDay ?? null,
      input.dueDay ?? null,
      (isInvestment ? input.rateBp : input.interestRateAnnualBp) ?? null,
      isInvestment ? 1 : 0,
      links.kind,
      links.fundingAccountId,
      input.type === 'credit_card' ? (input.minDueBp ?? null) : null,
      input.type === 'credit_card' ? (input.minDueFloorMinor ?? null) : null,
      isInvestment ? (input.units ?? null) : null,
      isInvestment ? (input.maturityDate ?? null) : null,
    ]
  );
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
  return rowToAccount(found(row, 'account'));
}

interface UpdateAccountInput {
  name: string;
  type: Account['type'];
  openingBalanceMinor: number;
  creditLimitMinor?: number | null;
  /** A credit card's statement and bill due days (1–31); both or neither. Cleared for any other type. */
  statementDay?: number | null;
  dueDay?: number | null;
  /** Track a savings account's value by hand. Omitted keeps the current setting; any other type is never tracked. */
  tracked?: boolean;
  /** An investment's kind. Omitted keeps the current one; null clears it. Always cleared when not tracked. */
  investmentKind?: InvestmentKind | null;
  /** The account its money normally comes from. Omitted keeps the current one; null clears it. */
  fundingAccountId?: string | null;
  /** A credit card's minimum due (basis points of the statement, and its floor). Cleared for any other type. */
  minDueBp?: number | null;
  minDueFloorMinor?: number | null;
  /** A tracked account's units, yearly rate (basis points) and maturity. Omitted keeps the current value. */
  units?: number | null;
  rateBp?: number | null;
  maturityDate?: string | null;
}

/**
 * Edits an account. Currency is locked: amounts are minor units with no conversion, so a change would
 * misstate history. Opening balance is safe to edit: the balance is derived (opening + ledger entries).
 */
export async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
  if (!input.name.trim()) {
    throw new Error('Account name is required');
  }
  if (!Number.isSafeInteger(input.openingBalanceMinor)) {
    throw new Error('Opening balance must be a valid number');
  }
  assertCycleDays(input.statementDay, input.dueDay);
  assertMinDue(input.minDueBp, input.minDueFloorMinor);
  assertHolding(input.units, input.rateBp, input.maturityDate);
  if (
    input.creditLimitMinor != null &&
    (!Number.isSafeInteger(input.creditLimitMinor) || input.creditLimitMinor < 0)
  ) {
    throw new Error('Credit limit must be a valid, non-negative number');
  }
  const db = await getDb();
  if (input.type === 'savings') {
    // A savings account only takes transfers (assertSpendableAccount). Turning one with spending or income on
    // it into savings would leave entries that can't be edited where they are: Add has no savings account
    // to offer them, and saving them there is refused.
    const spendRow = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM transactions
       WHERE account_id = ? AND type != 'transfer'
         AND (SELECT type FROM accounts WHERE id = ?) != 'savings'`,
      [id, id]
    );
    const spendCount = spendRow?.n ?? 0;
    if (spendCount > 0) {
      throw new Error(
        `This account has ${spendCount} income or expense ${spendCount === 1 ? 'entry' : 'entries'} on it, and a savings account only takes transfers. Keep its type, or add a new savings account and move money there.`
      );
    }
    // Reject retyping an account an active recurring rule points at: the next run would throw in
    // assertSpendableAccount and silently deactivate the rule. Same as deleteCategory's rule check.
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
  const current = await db.getFirstAsync<{
    tracked: number;
    currency: string;
    investment_kind: string | null;
    funding_account_id: string | null;
    units: number | null;
    maturity_date: string | null;
    interest_rate_annual_bp: number | null;
  }>(
    'SELECT tracked, currency, investment_kind, funding_account_id, units, maturity_date, interest_rate_annual_bp FROM accounts WHERE id = ?',
    [id]
  );
  const tracked =
    input.type !== 'savings'
      ? 0
      : input.tracked === undefined
        ? (current?.tracked ?? 0)
        : input.tracked
          ? 1
          : 0;
  const links = await resolveInvestmentLinks(
    db,
    id,
    current?.currency ?? (await getDefaultCurrency()),
    !!tracked,
    input.investmentKind === undefined
      ? ((current?.investment_kind as InvestmentKind | null) ?? null)
      : input.investmentKind,
    input.fundingAccountId === undefined ? (current?.funding_account_id ?? null) : input.fundingAccountId
  );
  await db.withTransactionAsync(async (tx) => {
    if (isCard || tracked) {
      const reserved = await tx.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM savings_goals WHERE reserve_account = 1 AND linked_account_id = ?',
        [id]
      );
      if (reserved?.n)
        throw new Error(
          'Switch reservation goals to manual tracking before making this account a credit card or tracked investment.'
        );
    }
    await tx.runAsync(
      `UPDATE accounts SET name = ?, type = ?, opening_balance_minor = ?, credit_limit_minor = ?, statement_day = ?, due_day = ?, tracked = ?, investment_kind = ?, funding_account_id = ?, min_due_bp = ?, min_due_floor_minor = ?, units = ?, maturity_date = ?, interest_rate_annual_bp = ? WHERE id = ?`,
      [
        input.name.trim(),
        input.type,
        input.openingBalanceMinor,
        input.creditLimitMinor ?? null,
        isCard ? (input.statementDay ?? null) : null,
        isCard ? (input.dueDay ?? null) : null,
        tracked,
        links.kind,
        links.fundingAccountId,
        isCard ? (input.minDueBp ?? null) : null,
        isCard ? (input.minDueFloorMinor ?? null) : null,
        tracked ? (input.units === undefined ? (current?.units ?? null) : input.units) : null,
        tracked
          ? input.maturityDate === undefined
            ? (current?.maturity_date ?? null)
            : input.maturityDate
          : null,
        // A card keeps the rate it was created with; a holding's rate is edited here.
        tracked
          ? input.rateBp === undefined
            ? (current?.interest_rate_annual_bp ?? null)
            : input.rateBp
          : (current?.interest_rate_annual_bp ?? null),
        id,
      ]
    );
  });
  // The summary figures need the grouped query, not the bare row.
  const account = (await listAccounts(true)).find((a) => a.id === id);
  if (!account) throw new Error('Account not found');
  return account;
}

/** Remembers the units held by a tracked account (set by a units x price update), or clears them with null. */
export async function setHoldingUnits(id: string, units: number | null): Promise<void> {
  if (units != null && (!Number.isFinite(units) || units < 0)) throw new Error('Units must be zero or more');
  const db = await getDb();
  await db.runAsync('UPDATE accounts SET units = ? WHERE id = ? AND tracked = 1', [units, id]);
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
 * Money in (income, transfers in) vs out (expenses, transfers out) over an inclusive date range, kept apart
 * so pass-through accounts differ from spending ones. Own currency: no default-currency filter.
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
 * Archives an account: hidden from pickers and totals, history kept (like `archiveCategory`), and linked loans'
 * `linked_account_id` keeps working (that FK is SET NULL only on real deletes). Recurring entries posting into
 * or out of it are paused, or they'd keep landing in an account hidden from every total. Unarchiving leaves
 * them paused to resume by hand.
 */
export async function archiveAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE accounts SET archived = 1 WHERE id = ?', [id]);
    await tx.runAsync('UPDATE recurring_rules SET active = 0 WHERE account_id = ? OR to_account_id = ?', [
      id,
      id,
    ]);
  });
  await rebuildNotificationsAfterCommit();
}

export async function unarchiveAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE accounts SET archived = 0 WHERE id = ?', [id]);
}

interface DeletedAccount extends RowSnapshot {
  /** Loans and goals that pointed at the account; the delete unlinks them (ON DELETE SET NULL), Undo relinks. */
  linkedLoanIds: string[];
  linkedGoalIds: string[];
}

/**
 * Permanently deletes a never-used account; one with history must be archived. Checked first so the user
 * gets a clear message, not the raw SQLite error from `ON DELETE RESTRICT` on `transactions.account_id`.
 */
export async function deleteAccount(id: string): Promise<DeletedAccount> {
  const db = await getDb();
  let snapshot: DeletedAccount | null = null;
  // Every check, the capture and the DELETE share one transaction: an entry (or value update, or repeating
  // rule) saved between a separate check and the delete can't slip past it.
  await db.withTransactionAsync(async (tx) => {
    const reservations = await tx.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM savings_goals WHERE reserve_account = 1 AND linked_account_id = ?',
      [id]
    );
    if (reservations?.n)
      throw new Error(
        'This account has reservation goals. Release them and switch their tracking mode before deleting the account.'
      );
    const valuations = await tx.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM account_valuations WHERE account_id = ?',
      [id]
    );
    if ((valuations?.total ?? 0) > 0) {
      throw new Error(
        'This account has value updates against it — archive it instead of deleting, so its history stays intact.'
      );
    }
    const countRow = await tx.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) as total FROM transactions WHERE account_id = ? OR to_account_id = ?',
      [id, id]
    );
    const count = countRow?.total ?? 0;
    if (count > 0) {
      throw new Error(
        `This account has ${count} transaction${count === 1 ? '' : 's'} against it — archive it instead of deleting, so its history stays intact.`
      );
    }
    // recurring_rules cascade on delete and Undo only restores the account row, so a rule would be lost for good.
    const rules = await tx.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM recurring_rules WHERE account_id = ? OR to_account_id = ?',
      [id, id]
    );
    if ((rules?.total ?? 0) > 0) {
      throw new Error(
        'This account has repeating entries set up against it — delete those first, or archive the account instead.'
      );
    }
    const row = await captureRow(tx, 'accounts', id);
    if (!row) throw new Error('This account is already deleted.');
    const loans = await tx.getAllAsync<{ id: string }>('SELECT id FROM loans WHERE linked_account_id = ?', [
      id,
    ]);
    const goals = await tx.getAllAsync<{ id: string }>(
      'SELECT id FROM savings_goals WHERE linked_account_id = ?',
      [id]
    );
    await tx.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
    snapshot = { ...row, linkedLoanIds: loans.map((l) => l.id), linkedGoalIds: goals.map((g) => g.id) };
  });
  return snapshot as unknown as DeletedAccount;
}

/**
 * Undoes `deleteAccount` — re-inserts the exact row, never a fresh one, and relinks the loans and goals that
 * pointed at it (unless one has been given another account since).
 */
export async function restoreAccount(snapshot: DeletedAccount): Promise<void> {
  const db = await getDb();
  const id = String(snapshot.row.id);
  await db.withTransactionAsync(async (tx) => {
    await restoreRow(tx, { table: snapshot.table, row: snapshot.row });
    for (const loanId of snapshot.linkedLoanIds) {
      await tx.runAsync('UPDATE loans SET linked_account_id = ? WHERE id = ? AND linked_account_id IS NULL', [
        id,
        loanId,
      ]);
    }
    for (const goalId of snapshot.linkedGoalIds) {
      await tx.runAsync(
        'UPDATE savings_goals SET linked_account_id = ? WHERE id = ? AND linked_account_id IS NULL',
        [id, goalId]
      );
    }
  });
}
