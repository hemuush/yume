import { recordGoalActivity } from './goalHistory';
import { getDb, AppDb } from './client';
import { ledgerFlowSql, valuationAdjSql } from './valuationSql';

export interface GoalReservationSummary {
  balanceMinor: number;
  reservedMinor: number;
  availableMinor: number;
  shortfallMinor: number;
  goals: { id: string; name: string; reservedMinor: number; archived: boolean }[];
}

/** Archived/completed goals retain their reservation until explicitly released. */
export async function reservationSummaryOn(db: AppDb, accountId: string): Promise<GoalReservationSummary> {
  const account = await db.getFirstAsync<{ balance: number }>(
    `SELECT a.opening_balance_minor + ${ledgerFlowSql('a')} + ${valuationAdjSql('a')} AS balance
     FROM accounts a WHERE a.id = ?`,
    [accountId]
  );
  if (!account) throw new Error('This account no longer exists');
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    reserved_amount_minor: number;
    archived: number;
  }>(
    `SELECT id, name, reserved_amount_minor, archived FROM savings_goals
     WHERE reserve_account = 1 AND linked_account_id = ? ORDER BY created_at, id`,
    [accountId]
  );
  const reservedMinor = rows.reduce((sum, g) => sum + g.reserved_amount_minor, 0);
  const balanceMinor = account.balance;
  if (!Number.isSafeInteger(balanceMinor) || !Number.isSafeInteger(reservedMinor) || reservedMinor < 0)
    throw new Error('These balances are too large or invalid to allocate safely.');
  return {
    balanceMinor,
    reservedMinor,
    availableMinor: Math.max(0, balanceMinor - reservedMinor),
    shortfallMinor: Math.max(0, reservedMinor - balanceMinor),
    goals: rows.map((g) => ({
      id: g.id,
      name: g.name,
      reservedMinor: g.reserved_amount_minor,
      archived: !!g.archived,
    })),
  };
}

export async function getGoalReservationSummary(accountId: string): Promise<GoalReservationSummary> {
  const db = await getDb();
  return db.exclusiveAsync((tx) => reservationSummaryOn(tx, accountId));
}

/** Only real, active cash balances in the default currency can receive new reservations. */
export async function assertReservableAccount(db: AppDb, accountId: string, exceptGoalId = '') {
  const account = await db.getFirstAsync<{
    type: string;
    tracked: number;
    archived: number;
    currency: string;
    default_currency: string;
  }>(
    `SELECT type, tracked, archived, currency,
     COALESCE((SELECT value FROM settings WHERE key = 'default_currency'), 'INR') AS default_currency
     FROM accounts WHERE id = ?`,
    [accountId]
  );
  if (
    !account ||
    account.archived ||
    account.type === 'credit_card' ||
    account.tracked ||
    account.currency !== account.default_currency
  )
    throw new Error(
      'Choose an active bank, cash, wallet or untracked savings account in your default currency.'
    );
  const following = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM savings_goals WHERE linked_account_id = ? AND track_account = 1 AND archived = 0 AND id != ? LIMIT 1`,
    [accountId, exceptGoalId]
  );
  if (following)
    throw new Error(
      'A goal follows this whole account. Switch it to reservations before sharing this money.'
    );
}

export async function changeReservationOn(db: AppDb, goalId: string, deltaMinor: number) {
  const goal = await db.getFirstAsync<{
    linked_account_id: string | null;
    reserve_account: number;
    reserved_amount_minor: number;
    archived: number;
  }>(
    'SELECT linked_account_id, reserve_account, reserved_amount_minor, archived FROM savings_goals WHERE id = ?',
    [goalId]
  );
  if (!goal?.reserve_account || !goal.linked_account_id)
    throw new Error('This goal no longer reserves from an account.');
  const next = goal.reserved_amount_minor + deltaMinor;
  if (!Number.isSafeInteger(next) || next < 0)
    throw new Error('Release no more than this goal has reserved.');
  if (deltaMinor > 0) {
    if (goal.archived) throw new Error('Unarchive this goal before reserving more.');
    await assertReservableAccount(db, goal.linked_account_id, goalId);
    const summary = await reservationSummaryOn(db, goal.linked_account_id);
    if (deltaMinor > summary.availableMinor)
      throw new Error('Not enough unreserved money in this account. Refresh and reserve a smaller amount.');
  }
  await db.runAsync('UPDATE savings_goals SET reserved_amount_minor = ? WHERE id = ?', [next, goalId]);
  await recordGoalActivity(db, goalId, deltaMinor, next, 'reservation');
}

/** Reassigns a reservation atomically; never creates a ledger movement, even during a shortfall. */
export async function moveGoalReservation(fromId: string, toId: string, amountMinor: number): Promise<void> {
  if (fromId === toId || !Number.isSafeInteger(amountMinor) || amountMinor <= 0)
    throw new Error('Choose another goal and a valid amount.');
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    const goals = await tx.getAllAsync<{
      id: string;
      linked_account_id: string | null;
      reserve_account: number;
      reserved_amount_minor: number;
      archived: number;
    }>(
      'SELECT id, linked_account_id, reserve_account, reserved_amount_minor, archived FROM savings_goals WHERE id IN (?, ?)',
      [fromId, toId]
    );
    const from = goals.find((g) => g.id === fromId),
      to = goals.find((g) => g.id === toId);
    if (
      !from?.reserve_account ||
      !to?.reserve_account ||
      !from.linked_account_id ||
      from.linked_account_id !== to.linked_account_id ||
      to.archived
    )
      throw new Error('Choose an active reservation goal in the same account.');
    if (
      amountMinor > from.reserved_amount_minor ||
      !Number.isSafeInteger(to.reserved_amount_minor + amountMinor)
    )
      throw new Error('This reservation has changed. Refresh and try again.');
    await tx.runAsync(
      'UPDATE savings_goals SET reserved_amount_minor = reserved_amount_minor - ? WHERE id = ?',
      [amountMinor, fromId]
    );
    await tx.runAsync(
      'UPDATE savings_goals SET reserved_amount_minor = reserved_amount_minor + ? WHERE id = ?',
      [amountMinor, toId]
    );
    await recordGoalActivity(
      tx,
      fromId,
      -amountMinor,
      from.reserved_amount_minor - amountMinor,
      'reservation'
    );
    await recordGoalActivity(tx, toId, amountMinor, to.reserved_amount_minor + amountMinor, 'reservation');
  });
}

/** Release the live amount, including a completed/archived goal, without a stale UI amount. */
export async function releaseGoalReservation(goalId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    const goal = await tx.getFirstAsync<{ reserve_account: number; reserved_amount_minor: number }>(
      'SELECT reserve_account, reserved_amount_minor FROM savings_goals WHERE id = ?',
      [goalId]
    );
    if (!goal?.reserve_account) throw new Error('This goal no longer reserves money.');
    await tx.runAsync('UPDATE savings_goals SET reserved_amount_minor = 0 WHERE id = ?', [goalId]);
    await recordGoalActivity(tx, goalId, -goal.reserved_amount_minor, 0, 'reservation');
  });
}
