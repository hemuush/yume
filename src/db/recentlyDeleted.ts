import { getDb, AppDb } from './client';
import { restoreRow, RowSnapshot } from './undoSnapshot';
import type { TransactionRow } from './rows';

/**
 * Entries wait here 30 days holding the exact row Undo captured, so restore keeps id, date and account.
 * Ordinary entries only (loan/person ones undo from their screens); not in backups, and a restore clears it.
 */

/** How long a deleted entry is kept before it's gone for good. */
export const KEEP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Keeps a just-deleted entry. Runs on the handle it's given, so it can join the delete's own transaction. */
export async function keepDeletedEntry(
  db: AppDb,
  snapshot: RowSnapshot,
  now: Date = new Date()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO deleted_entries (id, snapshot, deleted_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot, deleted_at = excluded.deleted_at`,
    [String(snapshot.row.id), JSON.stringify(snapshot.row), now.toISOString()]
  );
}

/** Drops an entry from the list — when Undo has already put it back. */
export async function forgetDeletedEntry(db: AppDb, id: string): Promise<void> {
  await db.runAsync('DELETE FROM deleted_entries WHERE id = ?', [id]);
}

/** Clears anything older than 30 days. Run as the app opens. */
export async function purgeExpiredDeletedEntries(db: AppDb, now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * DAY_MS).toISOString();
  await db.runAsync('DELETE FROM deleted_entries WHERE deleted_at < ?', [cutoff]);
}

export interface DeletedEntry {
  id: string;
  type: TransactionRow['type'];
  amountMinor: number;
  /** The entry's own date. */
  date: string;
  note: string;
  categoryId: string | null;
  accountId: string;
  deletedAt: string;
  /** Whole days left before it's cleared; at least 1 while it's still here. */
  daysLeft: number;
  /** Why it can't be put back (its account or category is gone), or null when it can. */
  blockedReason: string | null;
}

export function daysLeftOf(deletedAt: string, now: Date = new Date()): number {
  const age = now.getTime() - new Date(deletedAt).getTime();
  return Math.max(1, Math.ceil(KEEP_DAYS - age / DAY_MS));
}

/** Everything in the list, newest deletion first. */
export async function listDeletedEntries(now: Date = new Date()): Promise<DeletedEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; snapshot: string; deleted_at: string }>(
    'SELECT id, snapshot, deleted_at FROM deleted_entries ORDER BY deleted_at DESC'
  );
  const accountIds = new Set(
    (await db.getAllAsync<{ id: string }>('SELECT id FROM accounts')).map((r) => r.id)
  );
  const categoryIds = new Set(
    (await db.getAllAsync<{ id: string }>('SELECT id FROM categories')).map((r) => r.id)
  );
  const out: DeletedEntry[] = [];
  for (const r of rows) {
    let row: TransactionRow;
    try {
      const parsed = JSON.parse(r.snapshot);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      row = parsed as TransactionRow;
    } catch {
      continue; // A damaged snapshot can't be shown or restored; the 30-day purge clears it.
    }
    const accountGone =
      !accountIds.has(row.account_id) || (row.to_account_id != null && !accountIds.has(row.to_account_id));
    const categoryGone = row.category_id != null && !categoryIds.has(row.category_id);
    out.push({
      id: r.id,
      type: row.type,
      amountMinor: row.amount_minor,
      date: row.date,
      note: row.note ?? '',
      categoryId: row.category_id,
      accountId: row.account_id,
      deletedAt: r.deleted_at,
      daysLeft: daysLeftOf(r.deleted_at, now),
      blockedReason: accountGone
        ? 'Its account no longer exists'
        : categoryGone
          ? 'Its category no longer exists'
          : null,
    });
  }
  return out;
}

/** How many entries are waiting — for the Settings row. */
export async function countDeletedEntries(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM deleted_entries');
  return row?.n ?? 0;
}

/** Puts one back exactly as it was, and takes it off the list. */
export async function restoreDeletedEntry(id: string): Promise<void> {
  const db = await getDb();
  const kept = await db.getFirstAsync<{ snapshot: string }>(
    'SELECT snapshot FROM deleted_entries WHERE id = ?',
    [id]
  );
  if (!kept) throw new Error('This entry is no longer in Recently deleted.');
  let row: RowSnapshot['row'];
  try {
    const parsed = JSON.parse(kept.snapshot);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a row');
    row = parsed as RowSnapshot['row'];
  } catch {
    throw new Error('This entry is damaged and can no longer be restored.');
  }
  await db.withTransactionAsync(async (tx) => {
    const exists = await tx.getFirstAsync<{ id: string }>('SELECT id FROM transactions WHERE id = ?', [id]);
    if (!exists) await restoreRow(tx, { table: 'transactions', row });
    await tx.runAsync('DELETE FROM deleted_entries WHERE id = ?', [id]);
  });
}

/** Empties the list for good. */
export async function emptyDeletedEntries(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM deleted_entries');
}
