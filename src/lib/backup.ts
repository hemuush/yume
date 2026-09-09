import { getDb } from '@/db/client';
import { resetSettingsCache } from '@/db/settings';

export const BACKUP_FORMAT_VERSION = 1;

const TABLES = [
  'accounts',
  'categories',
  'loans',
  'loan_payments',
  'loan_rate_changes',
  'transactions',
  'savings_goals',
  'budgets',
  'recurring_rules',
  'people',
  'person_ledger_entries',
  'settings',
] as const;

export interface BackupSnapshot {
  formatVersion: number;
  exportedAt: string;
  tables: Record<string, any[]>;
}

/** Serializes every table to a single JSON-safe object — the full source of truth for restore. */
export async function buildBackupSnapshot(): Promise<BackupSnapshot> {
  const db = await getDb();
  const tables: Record<string, any[]> = {};
  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<any>(`SELECT * FROM ${table}`);
  }
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/**
 * Replaces all local data with the contents of a snapshot. Deletes in
 * child-before-parent order, then inserts in parent-before-child order, all
 * inside one transaction so a failure never leaves a half-restored database.
 *
 * Foreign keys are disabled for the duration: `transactions` and
 * `loan_payments` reference each other (a loan payment links to the
 * transaction that paid it; a transaction links back to the loan payment it
 * settles), so neither table can be fully inserted before the other without
 * a temporary FK violation. SQLite only allows toggling `PRAGMA foreign_keys`
 * outside an active transaction, so it's set before/after, not inside,
 * `withTransactionAsync`.
 */
function isValidSnapshotShape(snapshot: any): snapshot is BackupSnapshot {
  return (
    !!snapshot &&
    typeof snapshot === 'object' &&
    typeof snapshot.formatVersion === 'number' &&
    typeof snapshot.tables === 'object' &&
    snapshot.tables !== null
  );
}

export async function restoreFromSnapshot(snapshot: BackupSnapshot): Promise<void> {
  if (!isValidSnapshotShape(snapshot)) {
    throw new Error("This doesn't look like a Flynse backup file.");
  }
  if (snapshot.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup was made with a newer version of Flynse. Please update the app first.');
  }
  const db = await getDb();

  const deleteOrder = [...TABLES].reverse();
  const insertOrder = TABLES;

  // A backup file is arbitrary JSON picked by the user (or shared to them) —
  // never trusted to describe its own SQL shape. Column names come only from
  // the real table schema (via PRAGMA, itself just SQLite identifiers we
  // already control, not the file), and any key in a row that isn't a real
  // column is silently dropped rather than spliced into an INSERT statement.
  const columnsByTable: Record<string, Set<string>> = {};
  for (const table of TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    columnsByTable[table] = new Set(info.map((c) => c.name));
  }

  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async (tx) => {
      for (const table of deleteOrder) {
        await tx.runAsync(`DELETE FROM ${table}`);
      }
      for (const table of insertOrder) {
        const rows = snapshot.tables[table] ?? [];
        const validColumns = columnsByTable[table];
        for (const row of rows) {
          const columns = Object.keys(row).filter((c) => validColumns.has(c));
          if (columns.length === 0) continue;
          const placeholders = columns.map(() => '?').join(', ');
          const values = columns.map((c) => row[c]);
          await tx.runAsync(
            `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  // The restore above writes the settings table directly, bypassing every
  // setter in db/settings.ts — without this, formatMoney() and every other
  // cached-setting reader would keep showing pre-restore values (wrong
  // currency symbol, wrong accent, etc.) until the app is fully relaunched.
  resetSettingsCache();
}
