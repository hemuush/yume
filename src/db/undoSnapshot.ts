import type { AppDb, SqlParam } from './client';

/**
 * An exact raw copy of one row, bypassing the `rowToXxx` mappers. Schema-agnostic on purpose: restoring via plain
 * `INSERT` can't drift from the schema like a hand-kept column list, and works for every table Undo covers.
 */
export interface RowSnapshot {
  table: string;
  row: Record<string, SqlParam>;
}

/** Captures a table's row by id, before deleting it — null if it's already gone. */
export async function captureRow(db: AppDb, table: string, id: string): Promise<RowSnapshot | null> {
  const row = await db.getFirstAsync<Record<string, SqlParam>>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return row ? { table, row } : null;
}

/** Captures every row a query matches — for the two deletes that remove more than one row (a category's subcategories, a loan's payments/linked transactions). */
export async function captureRows(
  db: AppDb,
  table: string,
  where: string,
  params: SqlParam[]
): Promise<RowSnapshot[]> {
  const rows = await db.getAllAsync<Record<string, SqlParam>>(
    `SELECT * FROM ${table} WHERE ${where}`,
    params
  );
  return rows.map((row) => ({ table, row }));
}

/** Re-inserts one captured row, verbatim — same id, same every other column, never a fresh row. */
export async function restoreRow(db: AppDb, snapshot: RowSnapshot): Promise<void> {
  // The table and column names go straight into SQL, so they must be real ones: a snapshot that has been through
  // JSON storage (Recently deleted) or a damaged row can never inject into, or write to, anything else.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(snapshot.table))
    throw new Error('This item can no longer be restored.');
  const known = new Set(
    (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${snapshot.table})`)).map((c) => c.name)
  );
  const columns = Object.keys(snapshot.row);
  if (columns.length === 0 || columns.some((c) => !known.has(c))) {
    throw new Error('This item can no longer be restored.');
  }
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
