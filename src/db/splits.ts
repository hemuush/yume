import { getDb } from './client';
import { MIN_SPLIT_PARTS, MAX_SPLIT_PARTS } from '@/lib/splitLimits';
import { newId } from '@/lib/id';
import {
  assertValidTransactionInput,
  insertTransactionRow,
  checkOverspendForNewTransaction,
  rowToTransaction,
} from './transactions';
import { captureRows, restoreRows, RowSnapshot } from './undoSnapshot';
import { keepDeletedEntry, forgetDeletedEntry } from './recentlyDeleted';
import type { TransactionRow } from './rows';
import type { Transaction } from '@/types';

/**
 * Split payments (the Missing pieces sign-off): one bill from one account,
 * on one date with one note, spread across 2–6 expense categories. Each
 * part is a real entry in its own category (so budgets, Reports and the
 * Wrap count it there), and every part shares a `split_id` so Activity can
 * show them as the one payment they were.
 */

export { MIN_SPLIT_PARTS, MAX_SPLIT_PARTS };

export interface SplitPart {
  categoryId: string;
  amountMinor: number;
}

export interface SaveSplitInput {
  /** Set when editing a split: its parts are replaced as one change. */
  splitId?: string | null;
  /** Set when an ordinary entry is being split: it's replaced by the parts, in the same change. */
  replacesEntryId?: string | null;
  accountId: string;
  date: string;
  note?: string;
  parts: SplitPart[];
}

/** Checks the parts, before anything is written. */
export function splitProblem(parts: SplitPart[]): string | null {
  if (parts.length < MIN_SPLIT_PARTS) return 'A split needs at least 2 parts';
  if (parts.length > MAX_SPLIT_PARTS) return 'A split can have at most 6 parts';
  if (parts.some((p) => !p.categoryId)) return 'Pick a category for every part';
  if (parts.some((p) => !Number.isFinite(p.amountMinor) || p.amountMinor <= 0)) {
    return 'Every part needs an amount above zero';
  }
  return null;
}

/** Saves a split — a new one, or replacing an existing one's parts — and returns its id. */
export async function saveSplit(input: SaveSplitInput): Promise<string> {
  const problem = splitProblem(input.parts);
  if (problem) throw new Error(problem);
  const splitId = input.splitId ?? newId();
  const entries = input.parts.map((p) => ({
    type: 'expense' as const,
    accountId: input.accountId,
    categoryId: p.categoryId,
    amountMinor: p.amountMinor,
    date: input.date,
    note: input.note ?? '',
    splitId,
  }));
  for (const e of entries) await assertValidTransactionInput(e);
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    // Editing replaces the parts outright; the old ones aren't "deleted" in the sense of Recently deleted.
    if (input.splitId) await tx.runAsync('DELETE FROM transactions WHERE split_id = ?', [input.splitId]);
    if (input.replacesEntryId)
      await tx.runAsync('DELETE FROM transactions WHERE id = ?', [input.replacesEntryId]);
    for (const e of entries) await insertTransactionRow(tx, e);
  });
  for (const e of entries) await checkOverspendForNewTransaction(e);
  return splitId;
}

/** A split's parts, biggest first. */
export async function getSplitParts(splitId: string): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE split_id = ? ORDER BY amount_minor DESC, created_at ASC',
    [splitId]
  );
  return rows.map(rowToTransaction);
}

/**
 * Deletes every part of a split together — it was one payment — keeping each
 * in Recently deleted. Returns the rows, for Undo.
 */
export async function deleteSplit(splitId: string): Promise<RowSnapshot[]> {
  const db = await getDb();
  const snapshots = await captureRows(db, 'transactions', 'split_id = ?', [splitId]);
  if (snapshots.length === 0) throw new Error('This split is already deleted.');
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM transactions WHERE split_id = ?', [splitId]);
    for (const s of snapshots) await keepDeletedEntry(tx, s);
  });
  return snapshots;
}

/** Undoes deleteSplit: every part back exactly as it was, and off Recently deleted. */
export async function restoreSplit(snapshots: RowSnapshot[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await restoreRows(tx, snapshots);
    for (const s of snapshots) await forgetDeletedEntry(tx, String(s.row.id));
  });
}
