import { getDb, AppDb } from './client';
import { sensitiveOf } from './spendSql';
import { newId } from '@/lib/id';
import { assertValidIsoDate, toLocalIsoDate } from '@/lib/date';
import { rebuildAttentionNotificationsAfterCommit, rebuildNotificationsAfterCommit } from './afterCommit';
import { assertValidTransactionInput, insertTransactionRow } from './transactions';

export interface ExpectedRefund {
  id: string;
  transactionId: string;
  expectedMinor: number;
  receivedMinor: number;
  remainingMinor: number;
  dueDate: string | null;
  closed: boolean;
  currency: string;
  label: string;
  isSensitive?: boolean;
  receipts: {
    id: string;
    transactionId: string;
    amountMinor: number;
    date: string;
    createdTransaction: boolean;
  }[];
}
async function readOn(db: AppDb, transactionId: string): Promise<ExpectedRefund | null> {
  const row = await db.getFirstAsync<{
    id: string;
    expected_amount_minor: number;
    due_date: string | null;
    closed: number;
    currency: string;
    label: string;
    is_sensitive: number;
  }>(
    `SELECT r.*, a.currency, ${sensitiveOf('c')} AS is_sensitive, CASE WHEN t.note != '' THEN t.note ELSE c.name END AS label
     FROM refund_expectations r JOIN transactions t ON t.id = r.transaction_id
     JOIN accounts a ON a.id = t.account_id JOIN categories c ON c.id = t.category_id
     WHERE r.transaction_id = ?`,
    [transactionId]
  );
  if (!row) return null;
  const receipts = await db.getAllAsync<{
    id: string;
    transaction_id: string;
    amount_minor: number;
    date: string;
    created_transaction: number;
  }>(
    `SELECT rr.*, t.amount_minor, t.date FROM refund_receipts rr JOIN transactions t ON t.id = rr.transaction_id
     WHERE rr.expectation_id = ? ORDER BY t.date, rr.created_at`,
    [row.id]
  );
  const receivedMinor = receipts.reduce((s, r) => s + r.amount_minor, 0);
  return {
    id: row.id,
    transactionId,
    expectedMinor: row.expected_amount_minor,
    receivedMinor,
    remainingMinor: row.closed ? 0 : Math.max(0, row.expected_amount_minor - receivedMinor),
    dueDate: row.due_date,
    closed: !!row.closed,
    currency: row.currency,
    label: row.label,
    isSensitive: !!row.is_sensitive,
    receipts: receipts.map((r) => ({
      id: r.id,
      transactionId: r.transaction_id,
      amountMinor: r.amount_minor,
      date: r.date,
      createdTransaction: !!r.created_transaction,
    })),
  };
}
export async function getExpectedRefund(transactionId: string) {
  return (await getDb()).exclusiveAsync((db) => readOn(db, transactionId), { readOnly: true });
}
export async function listExpectedRefunds(): Promise<ExpectedRefund[]> {
  const rows = await (
    await getDb()
  ).getAllAsync<{
    id: string;
    transaction_id: string;
    expected_amount_minor: number;
    due_date: string | null;
    currency: string;
    label: string;
    is_sensitive: number;
    received: number;
  }>(
    `SELECT r.id, r.transaction_id, r.expected_amount_minor, r.due_date, a.currency, ${sensitiveOf('c')} AS is_sensitive,
     CASE WHEN p.note != '' THEN p.note ELSE c.name END AS label, COALESCE(SUM(t.amount_minor), 0) AS received
     FROM refund_expectations r JOIN transactions p ON p.id = r.transaction_id JOIN accounts a ON a.id = p.account_id
     JOIN categories c ON c.id = p.category_id LEFT JOIN refund_receipts rr ON rr.expectation_id = r.id
     LEFT JOIN transactions t ON t.id = rr.transaction_id WHERE r.closed = 0 GROUP BY r.id
     HAVING r.expected_amount_minor > COALESCE(SUM(t.amount_minor), 0) ORDER BY r.created_at`
  );
  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    expectedMinor: r.expected_amount_minor,
    receivedMinor: r.received,
    remainingMinor: r.expected_amount_minor - r.received,
    dueDate: r.due_date,
    closed: false,
    currency: r.currency,
    label: r.label,
    isSensitive: !!r.is_sensitive,
    receipts: [],
  }));
}
export async function expectRefund(
  transactionId: string,
  amountMinor: number,
  dueDate: string | null
): Promise<void> {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0)
    throw new Error('Enter a positive expected refund.');
  if (dueDate) assertValidIsoDate(dueDate);
  await (
    await getDb()
  ).withTransactionAsync(async (db) => {
    const purchase = await db.getFirstAsync<{
      type: string;
      amount_minor: number;
      loan_payment_id: string | null;
      loan_id: string | null;
      date: string;
    }>('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    const person = await db.getFirstAsync('SELECT id FROM person_ledger_entries WHERE transaction_id = ?', [
      transactionId,
    ]);
    if (!purchase || purchase.type !== 'expense' || purchase.loan_payment_id || purchase.loan_id || person)
      throw new Error('Choose an ordinary purchase to track a refund.');
    if (amountMinor > purchase.amount_minor) throw new Error('Expected refund cannot exceed this purchase.');
    if (dueDate && dueDate < purchase.date) throw new Error('Expected date cannot be before the purchase.');
    const current = await readOn(db, transactionId);
    if (current && amountMinor < current.receivedMinor)
      throw new Error('Expected amount cannot be below money already received.');
    if (current)
      await db.runAsync(
        'UPDATE refund_expectations SET expected_amount_minor = ?, due_date = ?, closed = 0 WHERE id = ?',
        [amountMinor, dueDate, current.id]
      );
    else
      await db.runAsync(
        'INSERT INTO refund_expectations (id, transaction_id, expected_amount_minor, due_date) VALUES (?, ?, ?, ?)',
        [newId(), transactionId, amountMinor, dueDate]
      );
  });
  await rebuildAttentionNotificationsAfterCommit('refundAlerts');
}
export async function receiveRefund(
  transactionId: string,
  input: { amountMinor: number; date: string; accountId: string; existingRefundId?: string }
): Promise<void> {
  assertValidIsoDate(input.date);
  const db = await getDb();
  let createdReceipt = false;
  await db.withTransactionAsync(async (tx) => {
    const refund = await readOn(tx, transactionId);
    const purchase = await tx.getFirstAsync<{ category_id: string; date: string; note: string }>(
      'SELECT category_id, date, note FROM transactions WHERE id = ?',
      [transactionId]
    );
    if (!refund || !purchase || refund.closed) throw new Error('This refund is no longer pending.');
    let amount = input.amountMinor;
    let receiptTransactionId = input.existingRefundId;
    if (receiptTransactionId) {
      const row = await tx.getFirstAsync<{
        amount_minor: number;
        type: string;
        is_refund: number;
        category_id: string;
        currency: string;
        date: string;
        loan_id: string | null;
        loan_payment_id: string | null;
      }>('SELECT t.*, a.currency FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.id = ?', [
        receiptTransactionId,
      ]);
      const used = await tx.getFirstAsync('SELECT id FROM refund_receipts WHERE transaction_id = ?', [
        receiptTransactionId,
      ]);
      const person = await tx.getFirstAsync('SELECT id FROM person_ledger_entries WHERE transaction_id = ?', [
        receiptTransactionId,
      ]);
      if (
        !row ||
        used ||
        person ||
        row.type !== 'income' ||
        !row.is_refund ||
        row.loan_id ||
        row.loan_payment_id ||
        row.category_id !== purchase.category_id ||
        row.currency !== refund.currency ||
        row.date < purchase.date ||
        row.date > toLocalIsoDate(new Date())
      )
        throw new Error('Choose an unlinked refund in the purchase’s category and currency.');
      amount = row.amount_minor;
    } else {
      if (input.date < purchase.date || input.date > toLocalIsoDate(new Date()))
        throw new Error('Record the actual received date, between the purchase and today.');
      const account = await tx.getFirstAsync<{ currency: string }>(
        'SELECT currency FROM accounts WHERE id = ?',
        [input.accountId]
      );
      if (account?.currency !== refund.currency)
        throw new Error('The receiving account must use the purchase’s currency.');
    }
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > refund.remainingMinor)
      throw new Error('Receive no more than the remaining expected refund.');
    if (!receiptTransactionId) {
      const posted = {
        type: 'income' as const,
        isRefund: true,
        categoryId: purchase.category_id,
        accountId: input.accountId,
        amountMinor: amount,
        date: input.date,
        note: purchase.note,
      };
      await assertValidTransactionInput(posted, tx);
      receiptTransactionId = await insertTransactionRow(tx, posted);
      createdReceipt = true;
    }
    await tx.runAsync(
      'INSERT INTO refund_receipts (id, expectation_id, transaction_id, created_transaction) VALUES (?, ?, ?, ?)',
      [newId(), refund.id, receiptTransactionId, input.existingRefundId ? 0 : 1]
    );
  });
  // A receipt changes follow-ups regardless of its ledger date. One rebuild also updates today's log nudge.
  if (createdReceipt) await rebuildNotificationsAfterCommit();
  else await rebuildAttentionNotificationsAfterCommit('refundAlerts');
}
export async function closeExpectedRefund(transactionId: string): Promise<void> {
  await (
    await getDb()
  ).withTransactionAsync(async (db) => {
    const refund = await readOn(db, transactionId);
    if (!refund) return;
    if (!refund.receipts.length)
      await db.runAsync('DELETE FROM refund_expectations WHERE id = ?', [refund.id]);
    else await db.runAsync('UPDATE refund_expectations SET closed = 1 WHERE id = ?', [refund.id]);
  });
  await rebuildAttentionNotificationsAfterCommit('refundAlerts');
}
export async function undoRefundReceipt(receiptId: string): Promise<void> {
  await (
    await getDb()
  ).withTransactionAsync(async (db) => {
    const row = await db.getFirstAsync<{
      transaction_id: string;
      expectation_id: string;
      created_transaction: number;
    }>('SELECT * FROM refund_receipts WHERE id = ?', [receiptId]);
    if (!row) throw new Error('This receipt has already been removed.');
    await db.runAsync('DELETE FROM refund_receipts WHERE id = ?', [receiptId]);
    if (row.created_transaction)
      await db.runAsync('DELETE FROM transactions WHERE id = ?', [row.transaction_id]);
    await db.runAsync('UPDATE refund_expectations SET closed = 0 WHERE id = ?', [row.expectation_id]);
  });
  await rebuildAttentionNotificationsAfterCommit('refundAlerts');
}
export async function refundCandidates(transactionId: string) {
  return (await getDb()).getAllAsync<{ id: string; date: string; amount_minor: number }>(
    `SELECT t.id, t.date, t.amount_minor FROM transactions t JOIN accounts a ON a.id = t.account_id
     JOIN transactions p ON p.id = ? JOIN accounts pa ON pa.id = p.account_id
     WHERE t.is_refund = 1 AND t.type = 'income' AND t.category_id = p.category_id AND a.currency = pa.currency AND t.date >= p.date AND t.date <= ?
     AND t.loan_id IS NULL AND t.loan_payment_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM person_ledger_entries pe WHERE pe.transaction_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM refund_receipts r WHERE r.transaction_id = t.id) ORDER BY t.date DESC LIMIT 30`,
    [transactionId, toLocalIsoDate(new Date())]
  );
}
