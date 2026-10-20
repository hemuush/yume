import { getDb, type AppDb } from './client';
import { newId } from '@/lib/id';

export interface GoalActivity {
  sequence: number;
  id: string;
  amount_minor: number;
  balance_after_minor: number;
  kind: 'manual' | 'reservation' | 'opening';
  currency: string;
  created_at: string;
}

/** Must share the transaction that changed progress. A journal entry never moves account money. */
export async function recordGoalActivity(
  db: AppDb,
  goalId: string,
  amountMinor: number,
  balanceMinor: number,
  kind: GoalActivity['kind']
): Promise<void> {
  if (!amountMinor) return;
  const row = await db.getFirstAsync<{ currency: string }>(
    `SELECT COALESCE(a.currency, (SELECT value FROM settings WHERE key = 'default_currency'), 'INR') AS currency
     FROM savings_goals g LEFT JOIN accounts a ON a.id = g.linked_account_id WHERE g.id = ?`,
    [goalId]
  );
  if (!row) throw new Error('This goal no longer exists.');
  await db.runAsync(
    'INSERT INTO goal_activity (id, goal_id, amount_minor, balance_after_minor, kind, currency) VALUES (?, ?, ?, ?, ?, ?)',
    [newId(), goalId, amountMinor, balanceMinor, kind, row.currency]
  );
}

/** Stable pagination even when several changes happen within the same second. */
export async function listGoalActivity(goalId: string, before?: number): Promise<GoalActivity[]> {
  const db = await getDb();
  return db.getAllAsync<GoalActivity>(
    `SELECT rowid AS sequence, * FROM goal_activity WHERE goal_id = ? ${before == null ? '' : 'AND rowid < ?'} ORDER BY rowid DESC LIMIT 20`,
    before == null ? [goalId] : [goalId, before]
  );
}
