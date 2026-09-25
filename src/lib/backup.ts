import { getDb } from '@/db/client';
import { resetSettingsCache } from '@/db/settings';
import { BACKFILL_LOAN_TX_KIND_SQL } from '@/db/loanTxKind';

/**
 * Settings that belong to the phone, never to the data — always the
 * current phone's values, never the backup's. The folder URI is a storage
 * grant only valid on the phone (and install) that made it: Android revokes
 * it on uninstall and it never carries across devices, so restoring a
 * backup's copy just points auto-backup at a folder it can't write to. The
 * last-backup status describes backups made on this phone.
 */
const DEVICE_BOUND_SETTINGS = ['local_backup_folder_uri', 'last_local_backup_at', 'last_local_backup_result'];

/**
 * Preferences where the phone's current value wins if it has one, otherwise
 * the backup's comes back. Restoring an older backup on the same phone
 * must not quietly switch the app lock off (or on) — but restoring onto a
 * fresh install or a new phone, where there's no current value yet, should
 * bring the user's lock preference back with the rest of their data.
 */
const CURRENT_WINS_SETTINGS = ['app_lock_enabled'];

const PHONE_SETTINGS = [...DEVICE_BOUND_SETTINGS, ...CURRENT_WINS_SETTINGS];

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
  // One exclusive slot for every table read: as separate queued reads,
  // another screen's write could land between two of them (a loan created
  // after `loans` was read but before `loan_payments` was), producing a
  // snapshot whose rows point at parents it doesn't contain.
  await db.exclusiveAsync(async (xdb) => {
    for (const table of TABLES) {
      tables[table] = await xdb.getAllAsync<any>(`SELECT * FROM ${table}`);
    }
  });
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

export interface RestoreResult {
  /**
   * `"table.column"` for every key present in the backup that isn't a real
   * column in this version's schema and was therefore not restored. Usually
   * empty; non-empty means the file was made by a build whose schema has
   * since changed (or was hand-edited), and the listed data did not come
   * back — the Backup screen surfaces this so a silent partial restore
   * can't pass for a complete one.
   */
  skippedColumns: string[];
}

export async function restoreFromSnapshot(snapshot: BackupSnapshot): Promise<RestoreResult> {
  if (!isValidSnapshotShape(snapshot)) {
    throw new Error("This doesn't look like a Yume backup file.");
  }
  if (snapshot.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup was made with a newer version of Yume. Please update the app first.');
  }
  // Older formatVersions currently restore as-is (v1 is the only format that
  // has ever shipped). When the format is first bumped, translate an older
  // snapshot up to the current shape here, before the insert loop below.
  const db = await getDb();

  const deleteOrder = [...TABLES].reverse();
  const insertOrder = TABLES;

  // A backup file is arbitrary JSON picked by the user (or shared to them) —
  // never trusted to describe its own SQL shape. Column names come only from
  // the real table schema (via PRAGMA, itself just SQLite identifiers we
  // already control, not the file), and any key in a row that isn't a real
  // column is dropped rather than spliced into an INSERT statement — but
  // every dropped key is recorded and reported back (see RestoreResult).
  const columnsByTable: Record<string, Set<string>> = {};
  for (const table of TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    columnsByTable[table] = new Set(info.map((c) => c.name));
  }
  const skipped = new Set<string>();

  // Every table's rows must be an array of plain objects before anything is
  // deleted — a malformed file is rejected here with the current data
  // untouched, rather than failing halfway through the insert loop.
  for (const table of TABLES) {
    const rows = snapshot.tables[table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
      throw new Error(
        `This backup file is damaged (the "${table}" section isn't readable) — nothing was changed.`
      );
    }
  }

  // All in one exclusive slot of the statement queue: `PRAGMA foreign_keys`
  // can only change outside a transaction, and as separate queued calls
  // another screen's statement could run between "FKs off" and the restore
  // transaction — e.g. a loan delete that then skipped its ON DELETE
  // CASCADE and left orphaned rows behind.
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
        for (const table of deleteOrder) {
          await tx.runAsync(`DELETE FROM ${table}`);
        }
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
            await tx.runAsync(
              `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
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
        // Foreign keys were off for the inserts (transactions and
        // loan_payments point at each other, so neither can go first), which
        // also meant nothing checked them. A hand-edited or truncated file
        // could leave a transaction pointing at an account that isn't there;
        // checking before commit rolls the whole restore back instead, with
        // the current data untouched.
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
  // A backup taken before the is_system column existed restores the built-in
  // categories unflagged; re-assert the flag now (restore doesn't run
  // migrations, and the app isn't relaunched after a restore). Mirrors
  // flagSystemCategories() in src/db/client.ts — kept inline here to avoid a
  // circular-ish import back into the db layer.
  await db.runAsync(
    `UPDATE categories SET is_system = 1 WHERE is_system = 0 AND parent_id IS NULL AND (
       (name = 'Loan EMI' AND kind = 'expense') OR
       (name = 'Loan Repayment' AND kind = 'income') OR
       (name = 'Fees & Charges' AND kind = 'expense') OR
       (name = 'Friends & Family')
     )`
  );
  // Same reasoning: a backup from before loan_tx_kind existed restores its
  // loan transactions untagged.
  await db.runAsync(BACKFILL_LOAN_TX_KIND_SQL);
  // The restore above writes the settings table directly, bypassing every
  // setter in db/settings.ts — without this, formatMoney() and every other
  // cached-setting reader would keep showing pre-restore values (wrong
  // currency symbol, wrong accent, etc.) until the app is fully relaunched.
  resetSettingsCache();

  return { skippedColumns: [...skipped].sort() };
}
