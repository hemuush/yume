import { getDb } from './client';
import { newId } from '@/lib/id';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { SavingsGoal } from '@/types';

/**
 * A target you're saving toward, tracked entirely by its own
 * `current_amount_minor` — deliberately not by a ledger of contribution
 * rows (there's no such table in the schema, unlike `loan_payments` or
 * `person_ledger_entries`, both of which do have one). `linkedAccountId` is
 * informational only ("this is the account I'm keeping it in"), not wired
 * to that account's real balance — nothing here creates a transaction, so
 * adding to a goal can never be confused with actually moving money.
 */

function rowToGoal(row: any): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    targetAmountMinor: row.target_amount_minor,
    currentAmountMinor: row.current_amount_minor,
    targetDate: row.target_date,
    linkedAccountId: row.linked_account_id,
    archived: !!row.archived,
    createdAt: row.created_at,
  };
}

export async function listSavingsGoals(includeArchived = false): Promise<SavingsGoal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM savings_goals ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY created_at ASC`
  );
  return rows.map(rowToGoal);
}

export interface SavingsGoalInput {
  name: string;
  targetAmountMinor: number;
  targetDate: string | null;
  linkedAccountId: string | null;
}

function validateInput(input: SavingsGoalInput): void {
  if (!input.name.trim()) throw new Error('Goal name is required');
  if (!Number.isFinite(input.targetAmountMinor) || input.targetAmountMinor <= 0) {
    throw new Error('Target amount must be a positive amount');
  }
}

export async function createSavingsGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
  validateInput(input);
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    `INSERT INTO savings_goals (id, name, target_amount_minor, current_amount_minor, target_date, linked_account_id, archived)
     VALUES (?, ?, ?, 0, ?, ?, 0)`,
    [id, input.name.trim(), input.targetAmountMinor, input.targetDate, input.linkedAccountId]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM savings_goals WHERE id = ?', [id]);
  return rowToGoal(row);
}

export async function updateSavingsGoal(id: string, input: SavingsGoalInput): Promise<void> {
  validateInput(input);
  const db = await getDb();
  await db.runAsync(
    `UPDATE savings_goals SET name = ?, target_amount_minor = ?, target_date = ?, linked_account_id = ? WHERE id = ?`,
    [input.name.trim(), input.targetAmountMinor, input.targetDate, input.linkedAccountId, id]
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
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM savings_goals WHERE id = ?', [id]);
  if (!existing) throw new Error('This goal no longer exists');
  await db.runAsync(
    'UPDATE savings_goals SET current_amount_minor = MAX(0, current_amount_minor + ?) WHERE id = ?',
    [deltaMinor, id]
  );
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
