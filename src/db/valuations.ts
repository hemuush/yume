import { getDb } from './client';
import { newId } from '@/lib/id';
import { isIsoDate } from '@/lib/date';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';

/** What a tracked account was worth on a date, as you entered it. */
export interface Valuation {
  id: string;
  accountId: string;
  /** YYYY-MM-DD. */
  date: string;
  valueMinor: number;
  /** Invested (opening + transfers in) as of that date. */
  investedMinor: number;
  /** Transfers out as of that date. */
  takenOutMinor: number;
  /** value + taken out − invested at that date. */
  gainMinor: number;
}

interface ValuationRow {
  id: string;
  account_id: string;
  date: string;
  value_minor: number;
  invested_minor: number;
  taken_out_minor: number;
}

function rowToValuation(r: ValuationRow): Valuation {
  return {
    id: r.id,
    accountId: r.account_id,
    date: r.date,
    valueMinor: r.value_minor,
    investedMinor: r.invested_minor,
    takenOutMinor: r.taken_out_minor,
    gainMinor: r.value_minor + r.taken_out_minor - r.invested_minor,
  };
}

const VALUATION_SELECT = `SELECT v.id, v.account_id, v.date, v.value_minor,
    a.opening_balance_minor + COALESCE((
      SELECT SUM(t.amount_minor) FROM transactions t
      WHERE t.type = 'transfer' AND t.to_account_id = v.account_id AND t.date <= v.date
    ), 0) AS invested_minor,
    COALESCE((
      SELECT SUM(t.amount_minor) FROM transactions t
      WHERE t.type = 'transfer' AND t.account_id = v.account_id AND t.date <= v.date
    ), 0) AS taken_out_minor
  FROM account_valuations v JOIN accounts a ON a.id = v.account_id`;

function assertInput(input: { date: string; valueMinor: number }): void {
  if (!isIsoDate(input.date)) throw new Error('Pick a valid date');
  if (!Number.isSafeInteger(input.valueMinor) || input.valueMinor < 0) {
    throw new Error('Enter what it is worth, as zero or more');
  }
}

/** A tracked account's value updates, newest first. */
export async function listValuations(accountId: string): Promise<Valuation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ValuationRow>(
    `${VALUATION_SELECT} WHERE v.account_id = ? ORDER BY v.date DESC, v.created_at DESC, v.rowid DESC`,
    [accountId]
  );
  return rows.map(rowToValuation);
}

async function getValuation(id: string): Promise<Valuation> {
  const db = await getDb();
  const row = await db.getFirstAsync<ValuationRow>(`${VALUATION_SELECT} WHERE v.id = ?`, [id]);
  if (!row) throw new Error('That value update no longer exists.');
  return rowToValuation(row);
}

/**
 * Records what a tracked account is worth on a date. A second update for the
 * same date replaces the first: two answers to "what was it worth on the 2nd"
 * would leave the later-saved one silently winning anyway.
 */
export async function addValuation(
  accountId: string,
  input: { date: string; valueMinor: number }
): Promise<Valuation> {
  assertInput(input);
  const db = await getDb();
  const account = await db.getFirstAsync<{ tracked: number }>('SELECT tracked FROM accounts WHERE id = ?', [
    accountId,
  ]);
  if (!account) throw new Error('Account not found');
  if (!account.tracked) throw new Error('Turn on "Track its value" for this account first.');
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM account_valuations WHERE account_id = ? AND date = ?',
    [accountId, input.date]
  );
  if (existing) {
    await db.runAsync('UPDATE account_valuations SET value_minor = ? WHERE id = ?', [
      input.valueMinor,
      existing.id,
    ]);
    return getValuation(existing.id);
  }
  const id = newId();
  await db.runAsync(
    'INSERT INTO account_valuations (id, account_id, date, value_minor) VALUES (?, ?, ?, ?)',
    [id, accountId, input.date, input.valueMinor]
  );
  return getValuation(id);
}

export async function updateValuation(
  id: string,
  input: { date: string; valueMinor: number }
): Promise<Valuation> {
  assertInput(input);
  const db = await getDb();
  const current = await db.getFirstAsync<{ account_id: string }>(
    'SELECT account_id FROM account_valuations WHERE id = ?',
    [id]
  );
  if (!current) throw new Error('That value update no longer exists.');
  const clash = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM account_valuations WHERE account_id = ? AND date = ? AND id != ?',
    [current.account_id, input.date, id]
  );
  if (clash) throw new Error('You already have a value update for that date — edit that one instead.');
  await db.runAsync('UPDATE account_valuations SET date = ?, value_minor = ? WHERE id = ?', [
    input.date,
    input.valueMinor,
    id,
  ]);
  return getValuation(id);
}

export async function deleteValuation(id: string): Promise<RowSnapshot> {
  const db = await getDb();
  const snapshot = await captureRow(db, 'account_valuations', id);
  if (!snapshot) throw new Error('That value update is already deleted.');
  await db.runAsync('DELETE FROM account_valuations WHERE id = ?', [id]);
  return snapshot;
}

/** Undoes `deleteValuation` — re-inserts the exact row. */
export async function restoreValuation(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await restoreRow(db, snapshot);
}
