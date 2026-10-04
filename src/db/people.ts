import { found } from './found';
import { PersonLedgerEntryRow, PersonRow } from './rows';
import { getDb, AppDb } from './client';
import { newId } from '@/lib/id';
import { Person, PersonLedgerEntry } from '@/types';
import { queueSpendAlerts } from './ledger';
import { captureRow, restoreRows, RowSnapshot } from './undoSnapshot';

function rowToPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    archived: !!row.archived,
    createdAt: row.created_at,
  };
}

function rowToEntry(row: PersonLedgerEntryRow): PersonLedgerEntry {
  return {
    id: row.id,
    personId: row.person_id,
    transactionId: row.transaction_id,
    amountMinor: row.amount_minor,
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
  };
}

export interface PersonWithBalance extends Person {
  balanceMinor: number; // positive = they owe you, negative = you owe them
  lastActivityDate: string | null;
}

export async function listPeople(includeArchived = false): Promise<PersonWithBalance[]> {
  const db = await getDb();
  // One grouped query instead of one extra query per person (each a
  // separate trip through the app-wide statement queue).
  const rows = await db.getAllAsync<PersonRow & { balance_total: number | null; last_date: string | null }>(
    `SELECT p.*,
       (SELECT SUM(e.amount_minor) FROM person_ledger_entries e WHERE e.person_id = p.id) AS balance_total,
       (SELECT MAX(e.date) FROM person_ledger_entries e WHERE e.person_id = p.id) AS last_date
     FROM people p ${includeArchived ? '' : 'WHERE p.archived = 0'} ORDER BY p.created_at ASC`
  );
  return rows.map((row) => ({
    ...rowToPerson(row),
    balanceMinor: row.balance_total ?? 0,
    lastActivityDate: row.last_date ?? null,
  }));
}

export async function createPerson(input: { name: string; notes?: string }): Promise<Person> {
  const db = await getDb();
  const id = newId();
  await db.runAsync('INSERT INTO people (id, name, notes) VALUES (?, ?, ?)', [
    id,
    input.name,
    input.notes ?? '',
  ]);
  const row = await db.getFirstAsync<PersonRow>('SELECT * FROM people WHERE id = ?', [id]);
  return rowToPerson(found(row, 'person'));
}

export async function getPersonLedger(personId: string): Promise<PersonLedgerEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PersonLedgerEntryRow>(
    'SELECT * FROM person_ledger_entries WHERE person_id = ? ORDER BY date DESC, created_at DESC',
    [personId]
  );
  return rows.map(rowToEntry);
}

/**
 * Records a plain IOU adjustment with no effect on any account balance (e.g. a friend owes you for a cash
 * payment made outside the app, or a debt was settled verbally).
 */
export async function addLedgerEntry(input: {
  personId: string;
  amountMinor: number;
  date: string;
  note?: string;
  transactionId?: string | null;
}): Promise<PersonLedgerEntry> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor === 0) {
    throw new Error('Ledger amount must be a non-zero number');
  }
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    `INSERT INTO person_ledger_entries (id, person_id, transaction_id, amount_minor, date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.personId, input.transactionId ?? null, input.amountMinor, input.date, input.note ?? '']
  );
  const row = await db.getFirstAsync<PersonLedgerEntryRow>(
    'SELECT * FROM person_ledger_entries WHERE id = ?',
    [id]
  );
  return rowToEntry(found(row, 'entry'));
}

/**
 * Inserts the transaction + ledger pair on `tx` directly, not via createTransaction()/addLedgerEntry(): those
 * write through the outer queued `db` and would deadlock on this transaction. Validation mirrors theirs.
 */
async function insertPersonMoneyMovement(
  tx: AppDb,
  input: {
    type: 'income' | 'expense';
    personId: string;
    accountId: string;
    categoryId: string;
    amountMinor: number;
    date: string;
    note?: string;
    ledgerAmountMinor: number;
  }
): Promise<void> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive number');
  }
  const acc = await tx.getFirstAsync<{ type: string }>('SELECT type FROM accounts WHERE id = ?', [
    input.accountId,
  ]);
  if (acc?.type === 'savings') {
    throw new Error(
      'Savings accounts can’t be used for income or expenses — transfer to a spendable account first.'
    );
  }
  const txId = newId();
  await tx.runAsync(
    `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [txId, input.type, input.accountId, input.categoryId, input.amountMinor, input.date, input.note ?? '']
  );
  await tx.runAsync(
    `INSERT INTO person_ledger_entries (id, person_id, transaction_id, amount_minor, date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newId(), input.personId, txId, input.ledgerAmountMinor, input.date, input.note ?? '']
  );
}

/**
 * Money left one of your accounts to cover a friend's expense (or you lent cash): records the expense
 * transaction and the matching ledger entry (they owe you more) as one unit.
 */
export async function recordMoneyGivenToPerson(input: {
  personId: string;
  accountId: string;
  categoryId: string;
  amountMinor: number;
  date: string;
  note?: string;
}): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync((tx) =>
    insertPersonMoneyMovement(tx, { ...input, type: 'expense', ledgerAmountMinor: input.amountMinor })
  );
  await queueSpendAlerts(input.categoryId).catch(() => {});
}

/**
 * A friend paid you back (or gave you money): records the income
 * transaction AND the matching ledger entry (they now owe you less).
 */
export async function recordMoneyReceivedFromPerson(input: {
  personId: string;
  accountId: string;
  categoryId: string;
  amountMinor: number;
  date: string;
  note?: string;
}): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync((tx) =>
    insertPersonMoneyMovement(tx, { ...input, type: 'income', ledgerAmountMinor: -input.amountMinor })
  );
}

/**
 * Reverses recordMoneyGivenToPerson / recordMoneyReceivedFromPerson: deletes the ledger entry and its linked
 * transaction together (editing would mean keeping amount and sign in sync by hand).
 */
export async function undoPersonTransaction(transactionId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    // Looked up inside the transaction that deletes it, so a concurrent undo can't leave this one deleting a
    // transaction whose ledger entry it never saw.
    const entry = await tx.getFirstAsync<{ id: string }>(
      'SELECT id FROM person_ledger_entries WHERE transaction_id = ?',
      [transactionId]
    );
    if (entry) {
      await tx.runAsync('DELETE FROM person_ledger_entries WHERE id = ?', [entry.id]);
    }
    await tx.runAsync('DELETE FROM transactions WHERE id = ?', [transactionId]);
  });
}

/**
 * Deletes a ledger entry starting from the entry itself, which also covers "just adjust balance" entries with
 * no linked transaction (undoPersonTransaction can't address those). Used by the person's History list.
 */
export async function deleteLedgerEntry(entryId: string): Promise<RowSnapshot[]> {
  const db = await getDb();
  let snapshots: RowSnapshot[] = [];
  // Snapshots are captured in the transaction that deletes the rows, so they are exactly what was removed.
  await db.withTransactionAsync(async (tx) => {
    const entrySnapshot = await captureRow(tx, 'person_ledger_entries', entryId);
    if (!entrySnapshot) throw new Error('Entry not found');
    const linkedTxId = entrySnapshot.row.transaction_id as string | null;
    const txSnapshot = linkedTxId ? await captureRow(tx, 'transactions', linkedTxId) : null;
    await tx.runAsync('DELETE FROM person_ledger_entries WHERE id = ?', [entryId]);
    if (linkedTxId) {
      await tx.runAsync('DELETE FROM transactions WHERE id = ?', [linkedTxId]);
    }
    // Transaction first (if any) — the entry's own `transaction_id` foreign
    // key needs it to already exist.
    snapshots = txSnapshot ? [txSnapshot, entrySnapshot] : [entrySnapshot];
  });
  return snapshots;
}

/** Undoes `deleteLedgerEntry` — re-inserts the entry (and its linked transaction, if it had one), in the same order they were captured. */
export async function restoreLedgerEntry(snapshots: RowSnapshot[]): Promise<void> {
  const db = await getDb();
  // One transaction: a failure on any row puts nothing back, not a ledger entry without its transaction.
  await db.withTransactionAsync(async (tx) => {
    await restoreRows(tx, snapshots);
  });
}
