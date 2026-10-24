import { found } from './found';
import { RecurringRuleRow } from './rows';
import { getDb } from './client';
import { newId } from '@/lib/id';
import {
  assertValidTransactionInput,
  insertTransactionRow,
  checkOverspendForNewTransaction,
  CreateTransactionInput,
} from './ledger';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { RecurringRule, RecurrenceFrequency, TransactionType, PaymentMode } from '@/types';
import { toLocalIsoDate, dayOfIsoDate, assertValidIsoDate } from '@/lib/date';
import { advanceDate } from '@/lib/recurrence';
import { rebuildAttentionNotificationsAfterCommit } from './afterCommit';

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
    anchorDay: row.anchor_day ?? null,
    postingMode: row.posting_mode ?? 'automatic',
    nextAmountMinor: row.next_amount_minor ?? null,
    scheduledDate: row.scheduled_date ?? null,
  };
}

function sameRuleInputs(a: RecurringRuleRow, b: RecurringRuleRow): boolean {
  return (
    a.type === b.type &&
    a.account_id === b.account_id &&
    a.to_account_id === b.to_account_id &&
    a.category_id === b.category_id &&
    a.amount_minor === b.amount_minor &&
    a.note === b.note &&
    a.payment_mode === b.payment_mode &&
    a.frequency === b.frequency &&
    a.interval_count === b.interval_count &&
    a.end_date === b.end_date &&
    a.anchor_day === b.anchor_day &&
    (a.posting_mode ?? 'automatic') === (b.posting_mode ?? 'automatic') &&
    (a.next_amount_minor ?? null) === (b.next_amount_minor ?? null) &&
    (a.scheduled_date ?? null) === (b.scheduled_date ?? null)
  );
}

// The cadence maths lives in lib (pure, shared with the month forecast); re-exported for existing callers.
export { advanceDate };

export interface RecurringRuleInput {
  postingMode?: 'automatic' | 'confirm';
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
  if (input.postingMode != null && !['automatic', 'confirm'].includes(input.postingMode))
    throw new Error('Choose how this entry is recorded.');
  assertValidIsoDate(input.nextRunDate);
  if (input.endDate) assertValidIsoDate(input.endDate);
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(input.frequency))
    throw new Error('Pick a valid repeat frequency');
  const next = advanceDate(
    input.nextRunDate,
    input.frequency,
    input.intervalCount,
    dayOfIsoDate(input.nextRunDate)
  );
  assertValidIsoDate(next);
  if (next <= input.nextRunDate) throw new Error('Repeat interval must advance the date');
  if (input.endDate && input.endDate < input.nextRunDate) {
    throw new Error('End date must be on or after the start date');
  }
  // Same rules createTransaction enforces when a rule fires, checked at save time so a bad rule can't
  // fail silently every cycle.
  await assertValidTransactionInput({ ...input, date: input.nextRunDate });
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
       frequency, interval_count, next_run_date, end_date, active, anchor_day, posting_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
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
      input.postingMode ?? 'automatic',
    ]
  );
  const row = await db.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
  await rebuildAttentionNotificationsAfterCommit('recurringAlerts');
  return rowToRule(found(row, 'recurring entry'));
}

export async function updateRecurringRule(id: string, input: RecurringRuleInput): Promise<RecurringRule> {
  await validate(input);
  const db = await getDb();
  // Keep the rule's real day unless its date moved, so an amount-only edit of a "31st" rule that shows the
  // clamped Feb 28 doesn't turn it into a "28th" rule. A genuinely new date re-anchors to its own day.
  const current = await db.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [
    id,
  ]);
  const keepsSchedule =
    current?.next_run_date === input.nextRunDate &&
    current.frequency === input.frequency &&
    current.interval_count === input.intervalCount;
  const anchorDay =
    keepsSchedule && current
      ? (current.anchor_day ?? dayOfIsoDate(input.nextRunDate))
      : dayOfIsoDate(input.nextRunDate);
  await db.withTransactionAsync(async (tx) => {
    const live = await tx.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
    if (!live || JSON.stringify(live) !== JSON.stringify(current))
      throw new Error('This recurring entry changed. Close and reopen it.');
    const linked = await tx.getFirstAsync<{ funding_currency: string | null; bill_currency: string | null }>(
      `SELECT funding.currency AS funding_currency, bill.currency AS bill_currency
       FROM annual_bill_goals b
       LEFT JOIN savings_goals g ON g.id = b.goal_id
       LEFT JOIN accounts funding ON funding.id = g.linked_account_id
       LEFT JOIN accounts bill ON bill.id = ?
       WHERE b.rule_id = ?`,
      [input.accountId, id]
    );
    if (linked) {
      if (input.type !== 'expense' || input.frequency !== 'yearly')
        throw new Error('Unlink the preparation goal before changing this bill’s type or frequency.');
      if (!linked.funding_currency || linked.funding_currency !== linked.bill_currency)
        throw new Error(
          'The bill and preparation account must use the same currency. Unlink the preparation goal before changing currency.'
        );
    }
    await tx.runAsync(
      `UPDATE recurring_rules SET
       type = ?, account_id = ?, to_account_id = ?, category_id = ?, amount_minor = ?, note = ?,
       payment_mode = ?, frequency = ?, interval_count = ?, next_run_date = ?, end_date = ?, anchor_day = ?, posting_mode = ?, next_amount_minor = ?, scheduled_date = ?
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
        input.postingMode ?? current?.posting_mode ?? 'automatic',
        keepsSchedule ? (current.next_amount_minor ?? null) : null,
        keepsSchedule ? (current.scheduled_date ?? null) : null,
        id,
      ]
    );
  });
  const row = await db.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [id]);
  await rebuildAttentionNotificationsAfterCommit('recurringAlerts');
  return rowToRule(found(row, 'recurring entry'));
}

/**
 * Pauses or resumes a rule. Resuming moves its next run up to the first date on or after `today` (on the
 * rule's own day), so a rule paused for months doesn't post every occurrence it missed the moment it resumes.
 */
export async function setRecurringRuleActive(
  id: string,
  active: boolean,
  today: string = toLocalIsoDate(new Date())
): Promise<void> {
  const db = await getDb();
  if (!active) {
    await db.runAsync('UPDATE recurring_rules SET active = 0 WHERE id = ?', [id]);
    await rebuildAttentionNotificationsAfterCommit('recurringAlerts');
    return;
  }
  const row = found(
    await db.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [id]),
    'recurring entry'
  );
  const anchorDay = row.anchor_day ?? dayOfIsoDate(row.next_run_date);
  let next = row.next_run_date;
  // Bounded like the runner: a broken interval can't spin forever.
  for (let i = 0; i < 5000 && next < today; i++) {
    next = advanceDate(
      next === row.next_run_date ? (row.scheduled_date ?? next) : next,
      row.frequency,
      Math.max(1, row.interval_count),
      anchorDay
    );
  }
  if (row.end_date && next > row.end_date) {
    throw new Error('This recurring entry has already ended. Edit its end date to resume it.');
  }
  await db.runAsync(
    'UPDATE recurring_rules SET active = 1, next_run_date = ?, next_amount_minor = ?, scheduled_date = ? WHERE id = ?',
    [
      next,
      next === row.next_run_date ? (row.next_amount_minor ?? null) : null,
      next === row.next_run_date ? (row.scheduled_date ?? null) : null,
      id,
    ]
  );
  await rebuildAttentionNotificationsAfterCommit('recurringAlerts');
}

export async function deleteRecurringRule(id: string): Promise<RowSnapshot> {
  const db = await getDb();
  let snapshot: RowSnapshot | null = null;
  // Captured inside the transaction that deletes it, so the snapshot is exactly the row removed even if a
  // run of due rules advances the rule meanwhile.
  await db.withTransactionAsync(async (tx) => {
    const preparation = await tx.getFirstAsync('SELECT goal_id FROM annual_bill_goals WHERE rule_id = ?', [
      id,
    ]);
    if (preparation) throw new Error('Unlink the preparation goal before deleting this annual bill.');
    const captured = await captureRow(tx, 'recurring_rules', id);
    if (!captured) throw new Error('This recurring entry is already deleted.');
    await tx.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
    snapshot = captured;
  });
  await rebuildAttentionNotificationsAfterCommit('recurringAlerts');
  return snapshot as unknown as RowSnapshot;
}

/** Undoes `deleteRecurringRule` — re-inserts the exact row, never a fresh one. */
export async function restoreRecurringRule(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await restoreRow(db, snapshot);
  await rebuildAttentionNotificationsAfterCommit('recurringAlerts');
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
    if (row.posting_mode === 'confirm') continue;
    const rule = rowToRule(row);
    // Null on rules saved before anchor_day existed — their stored date's own
    // day is the best record of their real day that survives.
    const anchorDay: number = row.anchor_day ?? dayOfIsoDate(rule.nextRunDate);
    const occurrence = (date: string): CreateTransactionInput => ({
      type: rule.type,
      accountId: rule.accountId,
      toAccountId: rule.toAccountId,
      categoryId: rule.categoryId,
      amountMinor: date === rule.nextRunDate ? (rule.nextAmountMinor ?? rule.amountMinor) : rule.amountMinor,
      date,
      note: rule.note,
      paymentMode: rule.paymentMode ?? undefined,
      ruleId: rule.id,
    });
    try {
      // Nothing checked here varies by date, so once per rule covers every occurrence; it must run outside
      // the transaction below because these checks read via the outer db and would deadlock.
      await assertValidTransactionInput(occurrence(rule.nextRunDate));
      let cursor = rule.nextRunDate;
      let iterations = 0;
      while (cursor <= referenceDate && iterations < 500) {
        const input = occurrence(cursor);
        const next = advanceDate(row.scheduled_date ?? cursor, rule.frequency, rule.intervalCount, anchorDay);
        const expired = !!rule.endDate && next > rule.endDate;
        let posted = false;
        await db.withTransactionAsync(async (tx) => {
          // An edit, pause, delete or restore can run between catch-up occurrences.
          // Compare the complete rule inside the same transaction as the insert.
          const current = await tx.getFirstAsync<RecurringRuleRow>(
            'SELECT * FROM recurring_rules WHERE id = ?',
            [rule.id]
          );
          if (
            !current ||
            !current.active ||
            current.next_run_date !== cursor ||
            !sameRuleInputs(current, row)
          )
            return;
          if (rule.endDate && cursor > rule.endDate) {
            await tx.runAsync('UPDATE recurring_rules SET active = 0 WHERE id = ?', [rule.id]);
            return;
          }
          await insertTransactionRow(tx, input);
          await tx.runAsync(
            'UPDATE recurring_rules SET next_run_date = ?, active = ?, next_amount_minor = NULL, scheduled_date = NULL WHERE id = ?',
            [next, expired ? 0 : 1, rule.id]
          );
          posted = true;
        });
        if (!posted) break;
        await checkOverspendForNewTransaction(input);
        created++;
        iterations++;
        cursor = next;
        row.next_amount_minor = null;
        row.scheduled_date = null;
        if (expired) break;
      }
    } catch (err) {
      // One rule's failure (e.g. its category was deleted) must not stop the rest of the batch or spin
      // re-attempting the same occurrence: deactivate it and move on.
      console.error(`Recurring rule ${rule.id} failed; deactivating it if unchanged:`, err);
      await db.withTransactionAsync(async (tx) => {
        const current = await tx.getFirstAsync<RecurringRuleRow>(
          'SELECT * FROM recurring_rules WHERE id = ?',
          [rule.id]
        );
        if (current && current.active && sameRuleInputs(current, row)) {
          await tx.runAsync('UPDATE recurring_rules SET active = 0 WHERE id = ?', [rule.id]);
        }
      });
    }
  }
  return created;
}
