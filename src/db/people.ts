import { getDb, AppDb } from './client';
import { newId } from '@/lib/id';
import { Person, PersonLedgerEntry } from '@/types';
import { checkOverspendAndNotify } from './ledger';

function rowToPerson(row: any): Person {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    archived: !!row.archived,
    createdAt: row.created_at,
  };
}

function rowToEntry(row: any): PersonLedgerEntry {
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
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM people ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY created_at ASC`
  );
  const people = rows.map(rowToPerson);
  const withBalances: PersonWithBalance[] = [];
  for (const person of people) {
    const bal = await db.getFirstAsync<{ total: number | null; lastDate: string | null }>(
      'SELECT SUM(amount_minor) as total, MAX(date) as lastDate FROM person_ledger_entries WHERE person_id = ?',
      [person.id]
    );
    withBalances.push({ ...person, balanceMinor: bal?.total ?? 0, lastActivityDate: bal?.lastDate ?? null });
  }
  return withBalances;
}

export async function createPerson(input: { name: string; notes?: string }): Promise<Person> {
  const db = await getDb();
  const id = newId();
  await db.runAsync('INSERT INTO people (id, name, notes) VALUES (?, ?, ?)', [
    id,
    input.name,
    input.notes ?? '',
  ]);
  const row = await db.getFirstAsync<any>('SELECT * FROM people WHERE id = ?', [id]);
  return rowToPerson(row);
}

export async function archivePerson(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE people SET archived = 1 WHERE id = ?', [id]);
}

export async function getPersonLedger(personId: string): Promise<PersonLedgerEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM person_ledger_entries WHERE person_id = ? ORDER BY date DESC, created_at DESC',
    [personId]
  );
  return rows.map(rowToEntry);
}

/**
 * Records a plain IOU adjustment with no effect on any account balance —
 * e.g. logging that a friend now owes you for something paid in cash outside
 * the app, or that a debt was verbally settled.
 */
export async function addLedgerEntry(input: {
  personId: string;
  amountMinor: number;
  date: string;
  note?: string;
  transactionId?: string | null;
}): Promise<PersonLedgerEntry> {
  if (!Number.isFinite(input.amountMinor) || input.amountMinor === 0) {
    throw new Error('Ledger amount must be a non-zero number');
  }
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    `INSERT INTO person_ledger_entries (id, person_id, transaction_id, amount_minor, date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.personId, input.transactionId ?? null, input.amountMinor, input.date, input.note ?? '']
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM person_ledger_entries WHERE id = ?', [id]);
  return rowToEntry(row);
}

/**
 * Inserts the transaction + ledger entry pair directly against `tx` rather
 * than calling the top-level createTransaction()/addLedgerEntry() — those
 * each call getDb() and write through the outer, queued `db` themselves,
 * which would enqueue behind this very transaction and deadlock (the
 * transaction can't finish until they run, and they can't run until the
 * transaction finishes). Validation mirrors createTransaction()'s own.
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
  if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive number');
  }
  const txId = newId();
  await tx.runAsync(
    `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]')`,
    [txId, input.type, input.accountId, input.categoryId, input.amountMinor, input.date, input.note ?? '']
  );
  await tx.runAsync(
    `INSERT INTO person_ledger_entries (id, person_id, transaction_id, amount_minor, date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newId(), input.personId, txId, input.ledgerAmountMinor, input.date, input.note ?? '']
  );
}

/**
 * Money actually left one of your accounts to cover a friend's expense (or
 * you lent them cash): records the expense transaction AND the matching
 * ledger entry (they now owe you more) as one unit.
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
  await checkOverspendAndNotify(input.categoryId).catch(() => {});
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
 * Reverses recordMoneyGivenToPerson / recordMoneyReceivedFromPerson: deletes
 * the ledger entry and its linked transaction together, so a mistaken entry
 * can be cleanly undone rather than edited (editing would need to keep the
 * transaction amount and the ledger amount/sign in sync by hand).
 */
export async function undoPersonTransaction(transactionId: string): Promise<void> {
  const db = await getDb();
  const entry = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM person_ledger_entries WHERE transaction_id = ?',
    [transactionId]
  );
  await db.withTransactionAsync(async (tx) => {
    if (entry) {
      await tx.runAsync('DELETE FROM person_ledger_entries WHERE id = ?', [entry.id]);
    }
    await tx.runAsync('DELETE FROM transactions WHERE id = ?', [transactionId]);
  });
}

/**
 * The other direction from undoPersonTransaction: deletes a ledger entry
 * starting from the entry itself, which also covers a "just adjust balance"
 * entry that has no linked transaction at all (undoPersonTransaction can't
 * address one of those — there's no transactionId to call it with). Used by
 * the person's own History list, where a mistaken entry previously had no
 * way to be removed at all.
 */
export async function deleteLedgerEntry(entryId: string): Promise<void> {
  const db = await getDb();
  const entry = await db.getFirstAsync<{ transaction_id: string | null }>(
    'SELECT transaction_id FROM person_ledger_entries WHERE id = ?',
    [entryId]
  );
  if (!entry) throw new Error('Entry not found');
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM person_ledger_entries WHERE id = ?', [entryId]);
    if (entry.transaction_id) {
      await tx.runAsync('DELETE FROM transactions WHERE id = ?', [entry.transaction_id]);
    }
  });
}
