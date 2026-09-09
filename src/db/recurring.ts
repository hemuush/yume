import { getDb } from './client';
import { newId } from '@/lib/id';
import { createTransaction } from './ledger';
import { RecurringRule, RecurrenceFrequency, TransactionType, PaymentMode } from '@/types';
import { toLocalIsoDate, addDaysToIsoDate, addMonthsToIsoDate } from '@/lib/date';

function rowToRule(row: any): RecurringRule {
  return {
    id: row.id,
    type: row.type,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    note: row.note,
    paymentMode: row.payment_mode ?? null,
    frequency: row.frequency,
    intervalCount: row.interval_count,
    nextRunDate: row.next_run_date,
    endDate: row.end_date,
    active: !!row.active,
  };
}

/** One step of a rule's own cadence — e.g. every 2 weeks advances 14 days at a time. */
function advanceDate(date: string, frequency: RecurrenceFrequency, intervalCount: number): string {
  switch (frequency) {
    case 'daily':
      return addDaysToIsoDate(date, intervalCount);
    case 'weekly':
      return addDaysToIsoDate(date, intervalCount * 7);
    case 'monthly':
      return addMonthsToIsoDate(date, intervalCount);
    case 'yearly':
      return addMonthsToIsoDate(date, intervalCount * 12);
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

function validate(input: RecurringRuleInput) {
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
  if (!Number.isInteger(input.intervalCount) || input.intervalCount <= 0) {
    throw new Error('Repeat interval must be a whole number of 1 or more');
  }
  if (input.endDate && input.endDate < input.nextRunDate) {
    throw new Error('End date must be on or after the start date');
  }
}

export async function listRecurringRules(): Promise<RecurringRule[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM recurring_rules ORDER BY active DESC, next_run_date ASC'
  );
  return rows.map(rowToRule);
}

export async function createRecurringRule(input: RecurringRuleInput): Promise<RecurringRule> {
  validate(input);
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    `INSERT INTO recurring_rules
      (id, type, account_id, to_account_id, category_id, amount_minor, note, payment_mode,
       frequency, interval_count, next_run_date, end_date, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
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
    ]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
  return rowToRule(row);
}

export async function updateRecurringRule(id: string, input: RecurringRuleInput): Promise<RecurringRule> {
  validate(input);
  const db = await getDb();
  await db.runAsync(
    `UPDATE recurring_rules SET
       type = ?, account_id = ?, to_account_id = ?, category_id = ?, amount_minor = ?, note = ?,
       payment_mode = ?, frequency = ?, interval_count = ?, next_run_date = ?, end_date = ?
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
      id,
    ]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
  return rowToRule(row);
}

export async function setRecurringRuleActive(id: string, active: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE recurring_rules SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
}

/**
 * Catches every active rule up to today, creating one real transaction per
 * missed occurrence (not just the most recent) — a rule left un-run for
 * three months while the app sat unused produces the three transactions
 * that genuinely should have happened, rather than silently collapsing them
 * into one or skipping straight to "now". Each occurrence goes through the
 * same createTransaction() every manual entry uses, so it behaves exactly
 * like a transaction the user typed in themselves (balances, reports,
 * overspend alerts all see it identically).
 *
 * Capped at 500 occurrences per rule as a defensive backstop — a
 * misconfigured daily rule with no end date left completely unattended for
 * years is the only realistic way to approach that, and stopping there
 * (rather than looping unbounded on app startup) is safer than hanging.
 */
export async function runDueRecurringRules(
  referenceDate: string = toLocalIsoDate(new Date())
): Promise<number> {
  const db = await getDb();
  const dueRules = await db.getAllAsync<any>(
    `SELECT * FROM recurring_rules WHERE active = 1 AND next_run_date <= ?`,
    [referenceDate]
  );

  let created = 0;
  for (const row of dueRules) {
    const rule = rowToRule(row);
    try {
      let cursor = rule.nextRunDate;
      let iterations = 0;
      let expired = false;
      while (cursor <= referenceDate && iterations < 500) {
        await createTransaction({
          type: rule.type,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          categoryId: rule.categoryId,
          amountMinor: rule.amountMinor,
          date: cursor,
          note: rule.note,
          paymentMode: rule.paymentMode ?? undefined,
        });
        created++;
        iterations++;
        cursor = advanceDate(cursor, rule.frequency, rule.intervalCount);
        if (rule.endDate && cursor > rule.endDate) {
          expired = true;
          break;
        }
      }
      await db.runAsync('UPDATE recurring_rules SET next_run_date = ?, active = ? WHERE id = ?', [
        cursor,
        expired ? 0 : 1,
        rule.id,
      ]);
    } catch (err) {
      // One rule's failure (e.g. its category was deleted out from under it)
      // must not stop the rest of the batch from running, and must not spin
      // forever re-attempting the same occurrence — deactivate it and move on.
      console.error(`Recurring rule ${rule.id} failed and was deactivated:`, err);
      await db.runAsync('UPDATE recurring_rules SET active = 0 WHERE id = ?', [rule.id]);
    }
  }
  return created;
}
