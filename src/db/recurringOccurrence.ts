import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';
import { getDb } from './client';
import type { RecurringRuleRow } from './rows';
import { advanceDate } from '@/lib/recurrence';
import { assertValidIsoDate, dayOfIsoDate, toLocalIsoDate } from '@/lib/date';
import {
  assertValidTransactionInput,
  insertTransactionRow,
  checkOverspendForNewTransaction,
  type CreateTransactionInput,
} from './ledger';
import { rebuildAttentionNotificationsAfterCommit } from './afterCommit';

type Change =
  | { kind: 'skip' }
  | { kind: 'change'; date: string; amountMinor: number }
  | { kind: 'confirm'; date: string; amountMinor: number };

/** Compare-and-set against the occurrence shown to the user; never silently act on a newer cycle. */
export async function changeNextOccurrence(
  ruleId: string,
  expectedDate: string,
  change: Change
): Promise<void> {
  if (change.kind !== 'skip') {
    assertValidIsoDate(change.date);
    if (
      !Number.isSafeInteger(change.amountMinor) ||
      change.amountMinor <= 0 ||
      change.amountMinor > MAX_AMOUNT_MINOR
    )
      throw new Error('Enter a valid amount.');
    if (change.kind === 'confirm' && change.date > toLocalIsoDate(new Date()))
      throw new Error('Choose today or an earlier payment date.');
  }
  const db = await getDb();
  const rule = await db.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [
    ruleId,
  ]);
  if (!rule?.active || rule.next_run_date !== expectedDate)
    throw new Error('This occurrence has changed. Close and reopen it.');
  let input: CreateTransactionInput | null = null;
  if (change.kind === 'confirm') {
    input = {
      type: rule.type,
      accountId: rule.account_id,
      toAccountId: rule.to_account_id,
      categoryId: rule.category_id,
      amountMinor: change.amountMinor,
      date: change.date,
      note: rule.note,
      paymentMode: rule.payment_mode as CreateTransactionInput['paymentMode'],
    };
    await assertValidTransactionInput(input);
  }
  const next = advanceDate(
    rule.scheduled_date ?? rule.next_run_date,
    rule.frequency,
    rule.interval_count,
    rule.anchor_day ?? dayOfIsoDate(rule.scheduled_date ?? rule.next_run_date)
  );
  if (
    change.kind === 'change' &&
    (change.date < rule.next_run_date ||
      change.date >= next ||
      (rule.end_date && change.date > rule.end_date))
  )
    throw new Error(
      'Postpone within this cycle, before the following occurrence and end date. Skip this occurrence if it is no longer needed.'
    );
  await db.withTransactionAsync(async (tx) => {
    const live = await tx.getFirstAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE id = ?', [
      ruleId,
    ]);
    if (!live || JSON.stringify(live) !== JSON.stringify(rule))
      throw new Error('This entry changed while you were editing. Close and reopen it.');
    if (change.kind === 'change') {
      await tx.runAsync(
        'UPDATE recurring_rules SET next_run_date = ?, next_amount_minor = ?, scheduled_date = ? WHERE id = ?',
        [change.date, change.amountMinor, rule.scheduled_date ?? rule.next_run_date, ruleId]
      );
    } else {
      if (input) {
        await assertValidTransactionInput(input, tx);
        await insertTransactionRow(tx, input);
      }
      await tx.runAsync(
        'UPDATE recurring_rules SET next_run_date = ?, active = ?, next_amount_minor = NULL, scheduled_date = NULL WHERE id = ?',
        [next, rule.end_date && next > rule.end_date ? 0 : 1, ruleId]
      );
    }
  });
  if (input) await checkOverspendForNewTransaction(input);
  await rebuildAttentionNotificationsAfterCommit('recurringAlerts');
}
