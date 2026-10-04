import { found } from './found';
import { RecurringRuleRow } from './rows';
import { getDb } from './client';
import { newId } from '@/lib/id';
import {
  assertSpendableAccount,
  assertSameCurrencyTransfer,
  assertValidTransactionInput,
  insertTransactionRow,
  checkOverspendForNewTransaction,
  CreateTransactionInput,
} from './ledger';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { RecurringRule, RecurrenceFrequency, TransactionType, PaymentMode } from '@/types';
import { toLocalIsoDate, addDaysToIsoDate, addMonthsToIsoDate, dayOfIsoDate } from '@/lib/date';

function rowToRule(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id,
    type: row.type,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    note: row.note,
    // No CHECK on this column: written only from PaymentMode values.
    paymentMode: (row.payment_mode as PaymentMode | null) ?? null,
    frequency: row.frequency,
    intervalCount: row.interval_count,
    nextRunDate: row.next_run_date,
    endDate: row.end_date,
    active: !!row.active,
  };
}

/**
 * One step of a rule's cadence (every 2 weeks = 14 days). `anchorDay` is the rule's real day-of-month:
 * steps chain from the previous (clamped) date, so without it a 31st rule would ride Feb 28 → Mar 28 forever.
 */
export function advanceDate(
  date: string,
  frequency: RecurrenceFrequency,
  intervalCount: number,
  anchorDay: number
): string {
  switch (frequency) {
    case 'daily':
      return addDaysToIsoDate(date, intervalCount);
    case 'weekly':
      return addDaysToIsoDate(date, intervalCount * 7);
    case 'monthly':
      return addMonthsToIsoDate(date, intervalCount, anchorDay);
    case 'yearly':
      return addMonthsToIsoDate(date, intervalCount * 12, anchorDay);
  }
}

export interface RecurringRuleInput {
  type: TransactionType;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amountMinor: number;
  note?: string;
  paymentMode?: PaymentMode | null;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  nextRunDate: string;
  endDate?: string | null;
}

async function validate(input: RecurringRuleInput) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
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
  if (!Number.isInteger(input.intervalCount) || input.intervalCount <= 0) {
    throw new Error('Repeat interval must be a whole number of 1 or more');
  }
  if (input.endDate && input.endDate < input.nextRunDate) {
    throw new Error('End date must be on or after the start date');
  }
  // Same rules createTransaction enforces when a rule fires, checked at save time so a bad rule can't
  // fail silently every cycle.
  await assertSpendableAccount(input.type, input.accountId);
  await assertSameCurrencyTransfer(input.type, input.accountId, input.toAccountId);
}

export async function listRecurringRules(): Promise<RecurringRule[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecurringRuleRow>(
    'SELECT * FROM recurring_rules ORDER BY active DESC, next_run_date ASC'
  );
  return rows.map(rowToRule);
}

export async function createRecurringRule(input: RecurringRuleInput): Promise<RecurringRule> {
  await validate(input);
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    `INSERT INTO recurring_rules
      (id, type, account_id, to_account_id, category_id, amount_minor, note, payment_mode,
       frequency, interval_count, next_run_date, end_date, active, anchor_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      input.type,
      input.accountId,
      input.type === 'transfer' ? (input.toAccountId ?? null) : null,
      input.type === 'transfer' ? null : (input.categoryId ?? null),
      input.amountMinor,
      input.note ?? '',
      input.paymentMode ?? null,
      input.frequency,
      input.intervalCount,
      input.nextRunDate,
      input.endDate ?? null,
      dayOfIsoDate(input.nextRunDate),
    ]
  );
  const row = await db.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
  return rowToRule(found(row, 'recurring entry'));
}

export async function updateRecurringRule(id: string, input: RecurringRuleInput): Promise<RecurringRule> {
  await validate(input);
  const db = await getDb();
  // Keep the rule's real day unless its date moved, so an amount-only edit of a "31st" rule that shows the
  // clamped Feb 28 doesn't turn it into a "28th" rule. A genuinely new date re-anchors to its own day.
  const current = await db.getFirstAsync<{ next_run_date: string; anchor_day: number | null }>(
    'SELECT next_run_date, anchor_day FROM recurring_rules WHERE id = ?',
    [id]
  );
  const anchorDay =
    current && current.next_run_date === input.nextRunDate
      ? (current.anchor_day ?? dayOfIsoDate(input.nextRunDate))
      : dayOfIsoDate(input.nextRunDate);
  await db.runAsync(
    `UPDATE recurring_rules SET
       type = ?, account_id = ?, to_account_id = ?, category_id = ?, amount_minor = ?, note = ?,
       payment_mode = ?, frequency = ?, interval_count = ?, next_run_date = ?, end_date = ?, anchor_day = ?
     WHERE id = ?`,
    [
      input.type,
      input.accountId,
      input.type === 'transfer' ? (input.toAccountId ?? null) : null,
      input.type === 'transfer' ? null : (input.categoryId ?? null),
      input.amountMinor,
      input.note ?? '',
      input.paymentMode ?? null,
      input.frequency,
      input.intervalCount,
      input.nextRunDate,
      input.endDate ?? null,
      anchorDay,
      id,
    ]
  );
  const row = await db.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
  return rowToRule(found(row, 'recurring entry'));
}

export async function setRecurringRuleActive(id: string, active: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE recurring_rules SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
}

export async function deleteRecurringRule(id: string): Promise<RowSnapshot> {
  const db = await getDb();
  let snapshot: RowSnapshot | null = null;
  // Captured inside the transaction that deletes it, so the snapshot is exactly the row removed even if a
  // run of due rules advances the rule meanwhile.
  await db.withTransactionAsync(async (tx) => {
    const captured = await captureRow(tx, 'recurring_rules', id);
    if (!captured) throw new Error('This recurring entry is already deleted.');
    await tx.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
    snapshot = captured;
  });
  return snapshot as unknown as RowSnapshot;
}

/** Undoes `deleteRecurringRule` — re-inserts the exact row, never a fresh one. */
export async function restoreRecurringRule(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await restoreRow(db, snapshot);
}

/**
 * Posts one transaction per missed occurrence per active rule (validated like manual entries, max 500/rule).
 * Insert + `next_run_date` advance commit together so a kill never re-posts; concurrent calls share one run.
 */
let inFlightRun: Promise<number> | null = null;

export function runDueRecurringRules(referenceDate: string = toLocalIsoDate(new Date())): Promise<number> {
  if (!inFlightRun) {
    inFlightRun = runDueRecurringRulesOnce(referenceDate).finally(() => {
      inFlightRun = null;
    });
  }
  return inFlightRun;
}

async function runDueRecurringRulesOnce(referenceDate: string): Promise<number> {
  const db = await getDb();
  const dueRules = await db.getAllAsync<RecurringRuleRow>(
    `SELECT * FROM recurring_rules WHERE active = 1 AND next_run_date <= ?`,
    [referenceDate]
  );

  let created = 0;
  for (const row of dueRules) {
    const rule = rowToRule(row);
    // Null on rules saved before anchor_day existed — their stored date's own
    // day is the best record of their real day that survives.
    const anchorDay: number = row.anchor_day ?? dayOfIsoDate(rule.nextRunDate);
    const occurrence = (date: string): CreateTransactionInput => ({
      type: rule.type,
      accountId: rule.accountId,
      toAccountId: rule.toAccountId,
      categoryId: rule.categoryId,
      amountMinor: rule.amountMinor,
      date,
      note: rule.note,
      paymentMode: rule.paymentMode ?? undefined,
    });
    try {
      // Nothing checked here varies by date, so once per rule covers every occurrence; it must run outside
      // the transaction below because these checks read via the outer db and would deadlock.
      await assertValidTransactionInput(occurrence(rule.nextRunDate));
      let cursor = rule.nextRunDate;
      let iterations = 0;
      while (cursor <= referenceDate && iterations < 500) {
        const input = occurrence(cursor);
        const next = advanceDate(cursor, rule.frequency, rule.intervalCount, anchorDay);
        const expired = !!rule.endDate && next > rule.endDate;
        await db.withTransactionAsync(async (tx) => {
          await insertTransactionRow(tx, input);
          await tx.runAsync('UPDATE recurring_rules SET next_run_date = ?, active = ? WHERE id = ?', [
            next,
            expired ? 0 : 1,
            rule.id,
          ]);
        });
        await checkOverspendForNewTransaction(input);
        created++;
        iterations++;
        cursor = next;
        if (expired) break;
      }
    } catch (err) {
      // One rule's failure (e.g. its category was deleted) must not stop the rest of the batch or spin
      // re-attempting the same occurrence: deactivate it and move on.
      console.error(`Recurring rule ${rule.id} failed and was deactivated:`, err);
      await db.runAsync('UPDATE recurring_rules SET active = 0 WHERE id = ?', [rule.id]);
    }
  }
  return created;
}
