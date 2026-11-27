import { rebuildNotificationsAfterCommit } from './afterCommit';
import { found } from './found';
import { TransactionRow } from './rows';
import { getDb, AppDb } from './client';
import { newId } from '@/lib/id';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { Transaction, TransactionType, PaymentMode } from '@/types';
import { toLocalIsoDate } from '@/lib/date';

import { queueSpendAlerts } from './spendAlerts';
import { rebuildNotifications } from '@/lib/notifications';
import { keepDeletedEntry, forgetDeletedEntry, assertRestorableEntry } from './recentlyDeleted';
import { rowToTransaction } from './transactionRow';
import { assertValidTransactionInput, type CreateTransactionInput } from './transactionRules';

/** Entries: create, update, links and delete (re-exported from ./ledger). Their rules, the row mapping and the reads live in
 * their own files and are exported from here too. */
export * from './transactionRow';
export * from './transactionRules';
export * from './transactionQueries';

/**
 * The raw INSERT behind createTransaction, on the outer db or a `tx` inside withTransactionAsync
 * (createTransaction would deadlock there). Does no validation: run assertValidTransactionInput first.
 */
export async function insertTransactionRow(db: AppDb, input: CreateTransactionInput): Promise<string> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO transactions
      (id, type, account_id, to_account_id, category_id, amount_minor, date, note, payment_mode, loan_payment_id, split_id, is_refund, rule_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.accountId,
      input.toAccountId ?? null,
      input.categoryId ?? null,
      input.amountMinor,
      input.date,
      (input.note ?? '').trim(),
      input.paymentMode ?? null,
      input.loanPaymentId ?? null,
      input.splitId ?? null,
      input.isRefund ? 1 : 0,
      input.ruleId ?? null,
    ]
  );
  return id;
}

/**
 * Post-write notifications (queueSpendAlerts): a current-month expense may queue an alert (which rebuilds
 * notifications); anything else dated today still rebuilds (evening nudge skips a logged day). Never throws.
 */
export async function checkOverspendForNewTransaction(input: CreateTransactionInput): Promise<void> {
  try {
    // The spending-jump check compares this month to last month, so a backdated entry (January logged in
    // September) would compare the wrong month and could pop a bogus alert.
    const today = toLocalIsoDate(new Date());
    const isCurrentMonth = input.date.slice(0, 7) === today.slice(0, 7);
    if (input.type === 'expense' && input.categoryId && isCurrentMonth) {
      await queueSpendAlerts(input.categoryId).catch(() => {});
    } else if (input.date === today) {
      await rebuildNotifications();
    }
  } catch (e) {
    // The entry is already committed: a notification hiccup must never be reported as a failed save (or, for a
    // recurring rule, deactivate it).
    console.warn('Post-save notification check failed:', e);
  }
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const db = await getDb();
  let created: Transaction | null = null;
  // A failed result read must roll back the INSERT, otherwise retrying a rejected save duplicates it.
  await db.withTransactionAsync(async (tx) => {
    await assertValidTransactionInput(input, tx);
    const id = await insertTransactionRow(tx, input);
    const row = await tx.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
    created = rowToTransaction(found(row, 'entry'));
    await input.afterWrite?.(tx);
  });
  const result = found<Transaction>(created, 'entry');
  await checkOverspendForNewTransaction(input);
  return result;
}

interface UpdateTransactionInput {
  type: TransactionType;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amountMinor: number;
  date: string;
  note?: string;
  paymentMode?: PaymentMode | null;
  /** Money back for a purchase. Omitted keeps what the entry was; a non-income type is never a refund. */
  isRefund?: boolean;
}

/** Checks links on the same handle that will edit/delete, so a stale screen cannot sever a ledger pair. */
export async function assertEditableTransactionOn(
  db: AppDb,
  id: string,
  allowSplit = false
): Promise<TransactionRow> {
  const row = found(
    await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]),
    'entry'
  );
  if (await transactionLinkOn(db, id)) {
    throw new Error(
      'This transaction is linked to a loan or person entry, or a tracked refund — open its detail and undo it from there.'
    );
  }
  if (row.split_id && !allowSplit) throw new Error('This is part of a split. Edit the whole split instead.');
  return row;
}

export async function updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
  const db = await getDb();
  let updated: Transaction | null = null;
  await db.withTransactionAsync(async (tx) => {
    const current = await assertEditableTransactionOn(tx, id);
    const isRefund = input.type === 'income' && (input.isRefund ?? !!current.is_refund);
    await assertValidTransactionInput({ ...input, isRefund }, tx);
    // Omitted mode stays as-is; changing type clears fields from the old kind.
    const keepPaymentMode = input.paymentMode === undefined;
    await tx.runAsync(
      `UPDATE transactions SET type = ?, account_id = ?, to_account_id = ?, category_id = ?, amount_minor = ?, date = ?, note = ?, is_refund = ?, day_rank = CASE WHEN date = ? THEN day_rank END${keepPaymentMode ? '' : ', payment_mode = ?'} WHERE id = ?`,
      [
        input.type,
        input.accountId,
        input.type === 'transfer' ? (input.toAccountId ?? null) : null,
        input.type === 'transfer' ? null : (input.categoryId ?? null),
        input.amountMinor,
        input.date,
        (input.note ?? '').trim(),
        isRefund ? 1 : 0,
        input.date,
        ...(keepPaymentMode ? [] : [input.paymentMode ?? null]),
        id,
      ]
    );
    const row = await tx.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
    updated = rowToTransaction(found(row, 'entry'));
  });
  await rebuildNotificationsAfterCommit();
  return found<Transaction>(updated, 'entry');
}

/**
 * Saves a hand-arranged day: `orderedIds` are that day's entries top to bottom.
 * Only rows really dated `date` are touched, so a stale id can't rank another day.
 */
export async function setDayOrder(date: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.runAsync('UPDATE transactions SET day_rank = ? WHERE id = ? AND date = ?', [
        i,
        orderedIds[i],
        date,
      ]);
    }
  });
}

export type TransactionLink =
  | { kind: 'loan'; loanPaymentId: string } // an EMI payment — undoInstallmentPayment reverses it
  | { kind: 'person' } // a Friends & Family entry — undoPersonTransaction reverses it
  | { kind: 'refund-received'; receiptId: string }
  | { kind: 'refund-expected' }
  | { kind: 'loan-unlinked' } // a loan disbursement or prepayment — no undo exists yet, block editing
  | null;

/**
 * Whether this is the cash side of a loan or Friends & Family entry (and which), so callers route to its undo.
 * EMIs link via loan_payments.transaction_id; disbursement/fee/prepayment rows via loan_id and can't be edited.
 */
export async function getTransactionLink(id: string): Promise<TransactionLink> {
  return transactionLinkOn(await getDb(), id);
}

/** getTransactionLink on a given handle, so deleteTransaction can run it inside its own transaction (reads run one at a time: a transaction handle can't take parallel ones). */
async function transactionLinkOn(db: AppDb, id: string): Promise<TransactionLink> {
  const loanRow = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM loan_payments WHERE transaction_id = ?',
    [id]
  );
  const personRow = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM person_ledger_entries WHERE transaction_id = ?',
    [id]
  );
  const own = await db.getFirstAsync<{ loan_id: string | null }>(
    'SELECT loan_id FROM transactions WHERE id = ?',
    [id]
  );
  if (loanRow) return { kind: 'loan', loanPaymentId: loanRow.id };
  if (personRow) return { kind: 'person' };
  if (own?.loan_id) return { kind: 'loan-unlinked' };
  const received = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM refund_receipts WHERE transaction_id = ?',
    [id]
  );
  if (received) return { kind: 'refund-received', receiptId: received.id };
  const expected = await db.getFirstAsync('SELECT id FROM refund_expectations WHERE transaction_id = ?', [
    id,
  ]);
  if (expected) return { kind: 'refund-expected' };
  return null;
}

/**
 * Deletes a plain transaction and keeps it in Recently deleted for 30 days (`{ keep: false }` is for taking back
 * an add a moment ago, which isn't worth finding later). Refuses loan-payment/person-linked ones (FKs are ON
 * DELETE SET NULL, so a raw delete would orphan the "paid" status or skew a balance): use
 * undoInstallmentPayment / undoPersonTransaction.
 */
export async function deleteTransaction(
  id: string,
  { keep = true }: { keep?: boolean } = {}
): Promise<RowSnapshot> {
  const db = await getDb();
  let snapshot: RowSnapshot | null = null;
  // Link check, capture and delete share one transaction, so the snapshot is exactly the row deleted and a
  // double-tap can't capture a row the other call is deleting.
  await db.withTransactionAsync(async (tx) => {
    if ((await transactionLinkOn(tx, id)) !== null) {
      throw new Error(
        'This transaction is linked to a loan or person entry, or a tracked refund — open its detail and undo it from there.'
      );
    }
    const captured = await captureRow(tx, 'transactions', id);
    if (!captured) throw new Error('This transaction is already deleted.');
    // One part alone would leave half a payment behind; a split is deleted whole (db/splits.ts).
    if (captured.row.split_id) throw new Error('This is part of a split. Delete the whole split instead.');
    await tx.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
    if (keep) await keepDeletedEntry(tx, captured);
    snapshot = captured;
  });
  await rebuildNotificationsAfterCommit();
  return snapshot as unknown as RowSnapshot;
}

/** Undoes `deleteTransaction` — re-inserts the exact row, never a fresh one, and takes it off Recently deleted. */
export async function restoreTransaction(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await assertRestorableEntry(tx, snapshot.row);
    await restoreRow(tx, snapshot);
    await forgetDeletedEntry(tx, String(snapshot.row.id));
  });
  await rebuildNotificationsAfterCommit();
}
