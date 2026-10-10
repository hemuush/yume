import { getDb, type AppDb } from '@/db/client';
import { resetSettingsCache } from '@/db/settings';
import { BACKFILL_LOAN_TX_KIND_SQL } from '@/db/loanTxKind';

/**
 * Phone-owned settings: always the current phone's values, never the backup's. The folder URI is a storage
 * grant valid only on the install that made it, and the last-backup status describes this phone's backups.
 */
const DEVICE_BOUND_SETTINGS = ['local_backup_folder_uri', 'last_local_backup_at', 'last_local_backup_result'];

/**
 * Preferences where the phone's value wins if set, else the backup's returns: an older backup must not
 * flip the app lock, but a fresh install/new phone should get the user's preference back.
 */
const CURRENT_WINS_SETTINGS = ['app_lock_enabled', 'hide_widget_values'];

const PHONE_SETTINGS = [...DEVICE_BOUND_SETTINGS, ...CURRENT_WINS_SETTINGS];

export const BACKUP_FORMAT_VERSION = 1;

const TABLES = [
  'accounts',
  'account_valuations',
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

/** One table row in a backup: column name → its JSON value. */
export type BackupRow = Record<string, string | number | boolean | null>;

export interface BackupSnapshot {
  formatVersion: number;
  exportedAt: string;
  tables: Record<string, BackupRow[]>;
}

/** Serializes every table to a single JSON-safe object — the full source of truth for restore. */
export async function buildBackupSnapshot(): Promise<BackupSnapshot> {
  return buildBackupSnapshotOn(await getDb());
}

/**
 * buildBackupSnapshot on a handle the caller already holds, so it can run inside the caller's own exclusive
 * section (a nested exclusiveAsync on the exclusive handle runs directly; getDb() there would deadlock).
 */
export async function buildBackupSnapshotOn(db: AppDb): Promise<BackupSnapshot> {
  const tables: Record<string, BackupRow[]> = {};
  // One exclusive slot for all table reads: separate reads would let another screen's write land between them
  // (a loan created after `loans` but before `loan_payments`), leaving rows that point at missing parents.
  await db.exclusiveAsync(async (xdb) => {
    for (const table of TABLES) {
      tables[table] = await xdb.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
    }
  });
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/**
 * Replaces all local data with a snapshot in one transaction: delete children first, insert parents first.
 * FKs off (transactions and loan_payments reference each other); the PRAGMA can't toggle in a transaction.
 */
function isValidSnapshotShape(snapshot: unknown): snapshot is BackupSnapshot {
  const s = snapshot as Partial<BackupSnapshot> | null;
  return (
    !!s &&
    typeof s === 'object' &&
    typeof s.formatVersion === 'number' &&
    typeof s.tables === 'object' &&
    s.tables !== null
  );
}

export interface RestoreResult {
  /**
   * `"table.column"` for each backup key that isn't a real column here and wasn't restored. Non-empty means
   * schema drift or a hand-edited file; surfaced so a partial restore isn't mistaken for a complete one.
   */
  skippedColumns: string[];
  /**
   * Tables this phone had data in that the backup has no section for (an older backup, from before that
   * table existed): restoring empties them, so they're named rather than lost without a word.
   */
  emptiedTables: string[];
}

export async function restoreFromSnapshot(snapshot: BackupSnapshot): Promise<RestoreResult> {
  return restoreFromSnapshotOn(await getDb(), snapshot);
}

/** restoreFromSnapshot on a handle the caller already holds (see buildBackupSnapshotOn). */
export async function restoreFromSnapshotOn(db: AppDb, snapshot: BackupSnapshot): Promise<RestoreResult> {
  if (!isValidSnapshotShape(snapshot)) {
    throw new Error("This doesn't look like a Yume backup file.");
  }
  if (snapshot.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup was made with a newer version of Yume. Please update the app first.');
  }
  // Older formatVersions restore as-is (v1 is the only format shipped). On the first bump, translate older
  // snapshots up to the current shape here, before the insert loop.

  const deleteOrder = [...TABLES].reverse();
  const insertOrder = TABLES;

  // The backup is untrusted JSON: column names come only from the real table schema (via PRAGMA), and unknown
  // row keys are dropped rather than spliced into an INSERT, but recorded and reported (see RestoreResult).
  const columnsByTable: Record<string, Set<string>> = {};
  for (const table of TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    columnsByTable[table] = new Set(info.map((c) => c.name));
  }
  const skipped = new Set<string>();
  const emptied: string[] = [];

  // Every table's rows must be an array of plain objects before anything is deleted, so a malformed file is
  // rejected with current data untouched rather than failing halfway through the inserts.
  for (const table of TABLES) {
    const rows = snapshot.tables[table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
      throw new Error(
        `This backup file is damaged (the "${table}" section isn't readable) — nothing was changed.`
      );
    } // Money is whole minor units everywhere: text or a fraction there would be stored as-is (SQLite accepts
    // it) and quietly break every total later, so it's rejected now, before anything is touched.
    const badAmount = rows.some((r) =>
      Object.entries(r as Record<string, unknown>).some(
        ([key, value]) => key.endsWith('_minor') && value != null && !Number.isSafeInteger(value)
      )
    );
    if (badAmount) {
      throw new Error(
        `This backup file is damaged (an amount in "${table}" isn't a number) — nothing was changed.`
      );
    }
  }

  // One exclusive statement-queue slot: `PRAGMA foreign_keys` only changes outside a transaction, and another
  // screen's statement between "FKs off" and the restore could skip an ON DELETE CASCADE and orphan rows.
  await db.exclusiveAsync(async (xdb) => {
    // This phone's own values for the settings that belong to it (see
    // DEVICE_BOUND_SETTINGS / CURRENT_WINS_SETTINGS), read before the wipe.
    const phoneValues = await xdb.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN (${PHONE_SETTINGS.map(() => '?').join(', ')})`,
      PHONE_SETTINGS
    );

    await xdb.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      await xdb.withTransactionAsync(async (tx) => {
        for (const table of TABLES) {
          if (snapshot.tables[table] !== undefined || table === 'settings') continue;
          const had = await tx.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
          if ((had?.n ?? 0) > 0) emptied.push(table);
        }
        for (const table of deleteOrder) {
          await tx.runAsync(`DELETE FROM ${table}`);
        }
        // Recently deleted belongs to the data being replaced, not the backup.
        await tx.runAsync('DELETE FROM deleted_entries');
        for (const table of insertOrder) {
          const rows = snapshot.tables[table] ?? [];
          const validColumns = columnsByTable[table];
          for (const row of rows) {
            const columns: string[] = [];
            for (const key of Object.keys(row)) {
              if (validColumns.has(key)) columns.push(key);
              else skipped.add(`${table}.${key}`);
            }
            if (columns.length === 0) continue;
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((c) => row[c]);
            // A damaged file with two value updates for one account and day keeps the later one rather than
            // failing the whole restore on the unique index.
            const verb = table === 'account_valuations' ? 'INSERT OR REPLACE' : 'INSERT';
            await tx.runAsync(
              `${verb} INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
              values
            );
          }
        }
        // Device-bound: the backup's copies never survive. Current-wins: the
        // backup's copy survives only when this phone had no value of its own.
        await tx.runAsync(
          `DELETE FROM settings WHERE key IN (${DEVICE_BOUND_SETTINGS.map(() => '?').join(', ')})`,
          DEVICE_BOUND_SETTINGS
        );
        for (const { key, value } of phoneValues) {
          await tx.runAsync(
            `INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [key, value]
          );
        }
        // A pre-is_system backup restores built-in categories unflagged; re-flag them (restore runs no
        // migrations). Mirrors flagSystemCategories() in src/db/client.ts, inline to avoid a circular-ish
        // db-layer import. Inside the transaction so a failure can't leave the restore half-finished.
        await tx.runAsync(
          `UPDATE categories SET is_system = 1 WHERE is_system = 0 AND parent_id IS NULL AND (
             (name = 'Loan EMI' AND kind = 'expense') OR
             (name = 'Loan Repayment' AND kind = 'income') OR
             (name = 'Fees & Charges' AND kind = 'expense') OR
             (name = 'Friends & Family')
           )`
        );
        // Same reasoning: a backup from before loan_tx_kind existed restores its loan transactions untagged.
        await tx.runAsync(BACKFILL_LOAN_TX_KIND_SQL);
        // FKs were off for the inserts, so nothing checked them; a damaged file could leave a transaction
        // pointing at a missing account. Checking before commit rolls back, leaving current data untouched.
        const broken = await tx.getAllAsync<{ table: string }>('PRAGMA foreign_key_check');
        if (broken.length > 0) {
          throw new Error(
            `This backup file is incomplete — ${broken.length} record${broken.length === 1 ? '' : 's'} in it point${
              broken.length === 1 ? 's' : ''
            } at data that isn't in the file. Nothing was changed.`
          );
        }
      });
    } finally {
      await xdb.execAsync('PRAGMA foreign_keys = ON;');
    }
  });
  // The restore writes the settings table directly, bypassing db/settings.ts setters; without this,
  // cached-setting readers (formatMoney, accent) would show pre-restore values until the app is relaunched.
  resetSettingsCache();

  return { skippedColumns: [...skipped].sort(), emptiedTables: emptied };
}

/** What a backup holds, in the terms the restore preview shows. */
export interface BackupSummary {
  entries: number;
  /** The latest entry's date, YYYY-MM-DD, or null with no entries. */
  lastEntryDate: string | null;
  accounts: number;
  loans: number;
}

/** Far beyond any real ledger's backup; a bigger picked file is something else, and reading it as text could exhaust memory. */
export const MAX_BACKUP_FILE_BYTES = 150 * 1024 * 1024;

export function isTooLargeForBackup(bytes: number | null | undefined): boolean {
  return bytes != null && bytes > MAX_BACKUP_FILE_BYTES;
}

/** A backup file's summary — or null when the file isn't a Yume backup at all. */
export function summarizeSnapshot(snapshot: unknown): BackupSummary | null {
  const tables = (snapshot as BackupSnapshot | null)?.tables;
  if (!tables || !Array.isArray(tables.transactions) || !Array.isArray(tables.accounts)) return null;
  const dates = tables.transactions
    .map((t: { date?: unknown }) => t.date)
    .filter((d): d is string => typeof d === 'string');
  return {
    entries: tables.transactions.length,
    lastEntryDate: dates.length > 0 ? dates.reduce((a, b) => (b > a ? b : a)) : null,
    accounts: tables.accounts.length,
    loans: Array.isArray(tables.loans) ? tables.loans.length : 0,
  };
}

/** The same summary for what's on the phone right now. */
export async function getCurrentSummary(): Promise<BackupSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    entries: number;
    last: string | null;
    accounts: number;
    loans: number;
  }>(
    `SELECT (SELECT COUNT(*) FROM transactions) AS entries,
       (SELECT MAX(date) FROM transactions) AS last,
       (SELECT COUNT(*) FROM accounts) AS accounts,
       (SELECT COUNT(*) FROM loans) AS loans`
  );
  return {
    entries: row?.entries ?? 0,
    lastEntryDate: row?.last ?? null,
    accounts: row?.accounts ?? 0,
    loans: row?.loans ?? 0,
  };
}

/** How many entries were saved after `iso` — what restoring a backup made then would lose. */
export async function countEntriesSavedAfter(iso: string): Promise<number> {
  const db = await getDb();
  const since = new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE created_at > ?',
    [since]
  );
  return row?.n ?? 0;
}
