import type { AppDb } from './client';

/**
 * A raw, exact copy of one row — every column SQLite returned for it,
 * untouched by any of the app-level `rowToXxx` mappers. Generic and
 * schema-agnostic on purpose: capturing "every column this row has" and
 * restoring it via a plain `INSERT` means a snapshot can never drift out of
 * sync with the schema the way a hand-maintained column list could, and the
 * same two functions work for every table an Undo needs to cover.
 */
export interface RowSnapshot {
  table: string;
  row: Record<string, any>;
}

/** Captures a table's row by id, before deleting it — null if it's already gone. */
export async function captureRow(db: AppDb, table: string, id: string): Promise<RowSnapshot | null> {
  const row = await db.getFirstAsync<Record<string, any>>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return row ? { table, row } : null;
}

/** Captures every row a query matches — for the two deletes that remove more than one row (a category's subcategories, a loan's payments/linked transactions). */
export async function captureRows(db: AppDb, table: string, where: string, params: any[]): Promise<RowSnapshot[]> {
  const rows = await db.getAllAsync<Record<string, any>>(`SELECT * FROM ${table} WHERE ${where}`, params);
  return rows.map((row) => ({ table, row }));
}

/** Re-inserts one captured row, verbatim — same id, same every other column, never a fresh row. */
export async function restoreRow(db: AppDb, snapshot: RowSnapshot): Promise<void> {
  const columns = Object.keys(snapshot.row);
  const placeholders = columns.map(() => '?').join(', ');
  await db.runAsync(
    `INSERT INTO ${snapshot.table} (${columns.join(', ')}) VALUES (${placeholders})`,
    columns.map((c) => snapshot.row[c])
  );
}

/** Restores a whole captured set in order — parents before the children whose foreign keys point at them. */
export async function restoreRows(db: AppDb, snapshots: RowSnapshot[]): Promise<void> {
  for (const snapshot of snapshots) await restoreRow(db, snapshot);
}
