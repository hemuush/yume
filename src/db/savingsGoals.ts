import { found } from './found';
import { SavingsGoalRow } from './rows';
import { getDb } from './client';
import { newId } from '@/lib/id';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { SavingsGoal } from '@/types';
import { valuationAdjSql } from './valuationSql';

/**
 * A target you're saving toward, tracked one of two ways:
 *
 * - By hand (the default): its own `current_amount_minor`, moved by "+ Add
 *   money" — deliberately not a ledger of contribution rows (there's no such
 *   table, unlike `loan_payments` or `person_ledger_entries`). Nothing here
 *   creates a transaction, so adding to a goal can never be confused with
 *   actually moving money. A linked account is then only a label.
 * - Following its linked account (`track_account = 1`): progress is that
 *   account's balance, worked out on every read the same way
 *   `getAccountBalance` does, so an entry or transfer moves the goal with no
 *   extra step. `current_amount_minor` is left untouched meanwhile.
 */

/** Reads SELECTed through GOAL_SELECT: the goal's row plus its account's balance when it follows one. */
const GOAL_SELECT = `
  SELECT g.*,
    CASE WHEN g.track_account = 1 AND a.id IS NOT NULL THEN
      a.opening_balance_minor
      + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                  WHERE (t.type = 'income' AND t.account_id = a.id)
                     OR (t.type = 'transfer' AND t.to_account_id = a.id)), 0)
      - COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                  WHERE (t.type = 'expense' AND t.account_id = a.id)
                     OR (t.type = 'transfer' AND t.account_id = a.id)), 0)
      + ${valuationAdjSql('a')}
    END AS account_balance_minor
  FROM savings_goals g
  LEFT JOIN accounts a ON a.id = g.linked_account_id`;

function rowToGoal(row: SavingsGoalRow & { account_balance_minor: number | null }): SavingsGoal {
  const balance = row.account_balance_minor;
  const tracksAccount = !!row.track_account && row.linked_account_id != null && balance != null;
  return {
    id: row.id,
    name: row.name,
    targetAmountMinor: row.target_amount_minor,
    currentAmountMinor: tracksAccount && balance != null ? Math.max(0, balance) : row.current_amount_minor,
    targetDate: row.target_date,
    linkedAccountId: row.linked_account_id,
    tracksAccount,
    noteToSelf: row.note_to_self,
    letterRevealed: !!row.letter_revealed,
    archived: !!row.archived,
    createdAt: row.created_at,
  };
}

export async function listSavingsGoals(includeArchived = false): Promise<SavingsGoal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SavingsGoalRow & { account_balance_minor: number | null }>(
    `${GOAL_SELECT} ${includeArchived ? '' : 'WHERE g.archived = 0'} ORDER BY g.created_at ASC`
  );
  return rows.map(rowToGoal);
}

export interface SavingsGoalInput {
  name: string;
  targetAmountMinor: number;
  targetDate: string | null;
  linkedAccountId: string | null;
  /** Follow the linked account's balance instead of adding money by hand. Ignored without an account. */
  tracksAccount?: boolean;
  /** Only ever set at creation — see `SavingsGoal.noteToSelf`'s own comment. */
  noteToSelf?: string | null;
}

function validateInput(input: SavingsGoalInput): void {
  if (!input.name.trim()) throw new Error('Goal name is required');
  if (!Number.isFinite(input.targetAmountMinor) || input.targetAmountMinor <= 0) {
    throw new Error('Target amount must be a positive amount');
  }
}

const trackFlag = (input: SavingsGoalInput) => (input.tracksAccount && input.linkedAccountId ? 1 : 0);

/** Other goals, not archived, that already follow this account — the form warns before a second one does. */
export async function goalsFollowingAccount(accountId: string, exceptGoalId?: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM savings_goals
     WHERE track_account = 1 AND archived = 0 AND linked_account_id = ? AND id != ?
     ORDER BY created_at ASC`,
    [accountId, exceptGoalId ?? '']
  );
  return rows.map((r) => r.name);
}

export async function createSavingsGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
  validateInput(input);
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    `INSERT INTO savings_goals (id, name, target_amount_minor, current_amount_minor, target_date, linked_account_id, note_to_self, letter_revealed, archived, track_account)
     VALUES (?, ?, ?, 0, ?, ?, ?, 0, 0, ?)`,
    [
      id,
      input.name.trim(),
      input.targetAmountMinor,
      input.targetDate,
      input.linkedAccountId,
      input.noteToSelf?.trim() || null,
      trackFlag(input),
    ]
  );
  const row = await db.getFirstAsync<SavingsGoalRow & { account_balance_minor: number | null }>(
    `${GOAL_SELECT} WHERE g.id = ?`,
    [id]
  );
  return rowToGoal(found(row, 'goal'));
}

export async function updateSavingsGoal(id: string, input: SavingsGoalInput): Promise<void> {
  validateInput(input);
  const db = await getDb();
  await db.runAsync(
    `UPDATE savings_goals SET name = ?, target_amount_minor = ?, target_date = ?, linked_account_id = ?, track_account = ? WHERE id = ?`,
    [
      input.name.trim(),
      input.targetAmountMinor,
      input.targetDate,
      input.linkedAccountId,
      trackFlag(input),
      id,
    ]
  );
}

/**
 * Adds (or, with a negative amount, removes — for correcting a mis-entered
 * contribution) money toward a goal. Clamped so it never goes below zero;
 * deliberately allowed to exceed the target, since saving more than planned
 * is a real outcome, not an error — the UI just caps the displayed percent.
 */
export async function contributeToGoal(id: string, deltaMinor: number): Promise<void> {
  if (!Number.isFinite(deltaMinor) || deltaMinor === 0) {
    throw new Error('Enter an amount to add or remove');
  }
  const db = await getDb();
  const existing = await db.getFirstAsync<{
    id: string;
    track_account: number;
    linked_account_id: string | null;
  }>('SELECT id, track_account, linked_account_id FROM savings_goals WHERE id = ?', [id]);
  if (!existing) throw new Error('This goal no longer exists');
  if (existing.track_account && existing.linked_account_id) {
    throw new Error("This goal follows its account's balance — move money into the account instead.");
  }
  await db.runAsync(
    'UPDATE savings_goals SET current_amount_minor = MAX(0, current_amount_minor + ?) WHERE id = ?',
    [deltaMinor, id]
  );
}

/**
 * Flips `letter_revealed` to 1, exactly once — called right after
 * `contributeToGoal` when the caller (`ContributeModal`) detects a
 * contribution just crossed the goal's target for the first time and a
 * `noteToSelf` exists. That crossing check lives client-side, not here:
 * the caller already holds the pre-contribution amount, so there's nothing
 * this function needs to compute or branch on — it only ever marks the
 * letter as shown.
 */
export async function markGoalLetterRevealed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE savings_goals SET letter_revealed = 1 WHERE id = ?', [id]);
}

export async function archiveSavingsGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE savings_goals SET archived = 1 WHERE id = ?', [id]);
}

export async function unarchiveSavingsGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE savings_goals SET archived = 0 WHERE id = ?', [id]);
}

/**
 * Permanently removes a goal — for one added by mistake or never funded, not
 * for one with real progress (archive that instead, same split
 * deleteAccount/deleteLoan/deleteCategory already use). Blocked whenever
 * money has actually been added toward it.
 */
export async function deleteSavingsGoal(id: string): Promise<RowSnapshot> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ current_amount_minor: number }>(
    'SELECT current_amount_minor FROM savings_goals WHERE id = ?',
    [id]
  );
  if (existing && existing.current_amount_minor > 0) {
    throw new Error(
      'This goal already has money saved toward it — archive it instead, so its progress stays intact.'
    );
  }
  const snapshot = await captureRow(db, 'savings_goals', id);
  if (!snapshot) throw new Error('This goal is already deleted.');
  await db.runAsync('DELETE FROM savings_goals WHERE id = ?', [id]);
  return snapshot;
}

/** Undoes `deleteSavingsGoal` — re-inserts the exact row, never a fresh one. */
export async function restoreSavingsGoal(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await restoreRow(db, snapshot);
}
