import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { CREATE_TABLES_SQL } from './schema';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { newId } from '@/lib/id';
import { primeCurrencyCache } from './settings';
import { BACKFILL_LOAN_TX_KIND_SQL } from './loanTxKind';
import { addMonthsToIsoDate } from '@/lib/date';
import { purgeExpiredDeletedEntries } from './recentlyDeleted';

const DB_NAME = 'yume.db';
const LEGACY_DB_NAME = 'flynse.db';

/**
 * Renames the pre-Yume `flynse.db` in place on first launch so an existing install keeps its data instead of
 * opening an empty `yume.db`. Best-effort: on failure the app starts empty (recoverable from a backup).
 */
async function migrateDbFilename(): Promise<void> {
  try {
    const sqliteDir = new Directory(Paths.document, 'SQLite');
    if (!sqliteDir.exists) return;
    const legacyMain = new File(sqliteDir, LEGACY_DB_NAME);
    const newMain = new File(sqliteDir, DB_NAME);
    if (!legacyMain.exists || newMain.exists) return;
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const src = new File(sqliteDir, `${LEGACY_DB_NAME}${suffix}`);
      if (src.exists) {
        await src.move(new File(sqliteDir, `${DB_NAME}${suffix}`));
      }
    }
  } catch (e) {
    console.warn('DB filename migration skipped:', e);
  }
}

/**
 * App-facing db handle: its own type, not `SQLite.SQLiteDatabase`, because `withTransactionAsync` passes a
 * `tx` to its callback (see serializeDb). Only used methods; src/test-support's AsyncDb mirrors this shape.
 */
/** One value bound to a `?` in a query — what expo-sqlite accepts. */
export type SqlParam = SQLite.SQLiteBindValue;

export interface AppDb {
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  runAsync(sql: string, params?: SqlParam[]): Promise<void>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: (tx: AppDb) => Promise<void>): Promise<void>;
  /**
   * Runs `task` as ONE queue entry with the raw connection, for work that can't interleave yet can't be one
   * transaction (restore's PRAGMA foreign_keys, backup read). Use the given handle, not outer db: deadlock.
   */
  exclusiveAsync<T>(task: (db: AppDb) => Promise<T>): Promise<T>;
}

// The in-flight (or resolved) db setup — see getDb(). Cached as a promise so
// concurrent first callers share one setup run.
let dbSetup: Promise<AppDb> | null = null;

/** Wraps a raw expo-sqlite connection with zero queuing — used both as the transaction `tx` handle and during one-time startup setup, before any screen exists to race against. */
function toAppDb(raw: SQLite.SQLiteDatabase): AppDb {
  const self: AppDb = {
    getFirstAsync: (sql, params = []) => raw.getFirstAsync(sql, params),
    getAllAsync: (sql, params = []) => raw.getAllAsync(sql, params),
    runAsync: async (sql, params = []) => {
      await raw.runAsync(sql, params);
    },
    execAsync: (sql) => raw.execAsync(sql),
    withTransactionAsync: (task) => raw.withTransactionAsync(() => task(self)),
    exclusiveAsync: (task) => task(self),
  };
  return self;
}

/**
 * expo-sqlite races concurrent calls (silent wrong/empty results), so every method is queued, one in flight.
 * Nested calls in a transaction must use its raw `tx`; a depth counter can't tell them from unrelated calls.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function serializeDb(raw: SQLite.SQLiteDatabase): AppDb {
  const rawDb = toAppDb(raw);
  return {
    getFirstAsync: (sql, params) => serialize(() => rawDb.getFirstAsync(sql, params)),
    getAllAsync: (sql, params) => serialize(() => rawDb.getAllAsync(sql, params)),
    runAsync: (sql, params) => serialize(() => rawDb.runAsync(sql, params)),
    execAsync: (sql) => serialize(() => rawDb.execAsync(sql)),
    withTransactionAsync: (task) => serialize(() => rawDb.withTransactionAsync(task)),
    exclusiveAsync: (task) => serialize(() => task(rawDb)),
  };
}

/**
 * CREATE TABLE IF NOT EXISTS skips existing tables, so a newly added column never reaches upgraded installs;
 * this adds the column if missing.
 */
/** Returns true only when the column was actually just added (fresh installs already have it via CREATE_TABLES_SQL and never hit this branch), so callers can run a one-time backfill exactly once. */
async function ensureColumn(db: AppDb, table: string, column: string, ddl: string): Promise<boolean> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (cols.some((c) => c.name === column)) return false;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  return true;
}

/**
 * Flags name-matched built-ins (Loan EMI/Repayment, Fees & Charges, Friends & Family) `is_system`; idempotent.
 * backup.ts repeats it inline (restore skips migrations). Only unflagged top-level rows with seeded names.
 */
async function flagSystemCategories(db: AppDb): Promise<void> {
  await db.runAsync(
    `UPDATE categories SET is_system = 1 WHERE is_system = 0 AND parent_id IS NULL AND (
       (name = 'Loan EMI' AND kind = 'expense') OR
       (name = 'Loan Repayment' AND kind = 'income') OR
       (name = 'Fees & Charges' AND kind = 'expense') OR
       (name = 'Friends & Family')
     )`
  );
}

// Remaps old saturated seed colours (Tailwind-style hues) to the pastel band for earlier installs;
// matches name + kind + exact old colour, so recoloured or user-made categories stay untouched. Idempotent.
const LEGACY_CATEGORY_COLOR_REMAP: { name: string; kind: 'income' | 'expense'; from: string; to: string }[] =
  [
    { name: 'Salary', kind: 'income', from: '#22C55E', to: '#7FE0A8' },
    { name: 'Business', kind: 'income', from: '#16A34A', to: '#8FE8C8' },
    { name: 'Interest & Dividends', kind: 'income', from: '#15803D', to: '#C5E0A0' },
    { name: 'Gifts Received', kind: 'income', from: '#4ADE80', to: '#FFEA9E' },
    { name: 'Other Income', kind: 'income', from: '#86EFAC', to: '#A8D8FF' },
    { name: 'Loan Repayment', kind: 'income', from: '#0F766E', to: '#8FE0DC' },
    { name: 'Friends & Family', kind: 'income', from: '#65A30D', to: '#D8B8FF' },
    { name: 'Food & Dining', kind: 'expense', from: '#F97316', to: '#FF9E7D' },
    { name: 'Groceries', kind: 'expense', from: '#EA580C', to: '#FFC24D' },
    { name: 'Rent', kind: 'expense', from: '#DC2626', to: '#FF8FA3' },
    { name: 'Utilities', kind: 'expense', from: '#B91C1C', to: '#8FE0F0' },
    { name: 'Transport', kind: 'expense', from: '#0EA5E9', to: '#8FCBFF' },
    { name: 'Fuel', kind: 'expense', from: '#0284C7', to: '#A8B8FF' },
    { name: 'Health & Medical', kind: 'expense', from: '#E11D48', to: '#FFA8CE' },
    { name: 'Shopping', kind: 'expense', from: '#A855F7', to: '#C9B8FF' },
    { name: 'Entertainment', kind: 'expense', from: '#8B5CF6', to: '#FFD84D' },
    { name: 'Education', kind: 'expense', from: '#6366F1', to: '#A8D8FF' },
    { name: 'Subscriptions', kind: 'expense', from: '#4F46E5', to: '#8FE8C8' },
    { name: 'Insurance', kind: 'expense', from: '#334155', to: '#E0C29A' },
    { name: 'Loan EMI', kind: 'expense', from: '#78350F', to: '#E0A8C9' },
    { name: 'Credit Card Payment', kind: 'expense', from: '#92400E', to: '#C5E0A0' },
    { name: 'Investments', kind: 'expense', from: '#0D9488', to: '#8FE0DC' },
    { name: 'Savings Deposit', kind: 'expense', from: '#0F766E', to: '#7FE0A8' },
    { name: 'Gifts & Donations', kind: 'expense', from: '#DB2777', to: '#FFEA9E' },
    { name: 'Travel', kind: 'expense', from: '#0891B2', to: '#8FE0F0' },
    { name: 'Fees & Charges', kind: 'expense', from: '#57534E', to: '#E0C29A' },
    { name: 'Friends & Family', kind: 'expense', from: '#65A30D', to: '#D8B8FF' },
    { name: 'Miscellaneous', kind: 'expense', from: '#71717A', to: '#A8D8FF' },
  ];

async function remapLegacyCategoryColors(db: AppDb): Promise<void> {
  for (const r of LEGACY_CATEGORY_COLOR_REMAP) {
    await db.runAsync('UPDATE categories SET color = ? WHERE name = ? AND kind = ? AND color = ?', [
      r.to,
      r.name,
      r.kind,
      r.from,
    ]);
  }
}

/**
 * Run-once ordered steps for changes unsafe to repeat (copying values, dropping/rebuilding tables);
 * each `version` is +1, kept in PRAGMA user_version. Repeat-safe changes go in applyIdempotentMigrations.
 */
export interface VersionedMigration {
  version: number;
  run: (db: AppDb) => Promise<void>;
}
export const MIGRATIONS: readonly VersionedMigration[] = [];

/** The highest version in MIGRATIONS, or 1 (the pre-versioning baseline) while it is empty. */
const latestSchemaVersion = (steps: readonly VersionedMigration[]): number =>
  Math.max(1, ...steps.map((m) => m.version));

/**
 * Exported for tests; runs once in initDb's transaction so a failed step rolls back with its version stamp.
 * A database already past this build's version (newer app's file) is left alone: never lowered, no re-runs.
 */
export async function runMigrations(
  db: AppDb,
  steps: readonly VersionedMigration[] = MIGRATIONS
): Promise<void> {
  await applyIdempotentMigrations(db);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const stored = row?.user_version ?? 0;
  for (const step of [...steps].sort((a, b) => a.version - b.version)) {
    if (step.version > stored) await step.run(db);
  }
  const latest = latestSchemaVersion(steps);
  if (latest > stored) await db.execAsync(`PRAGMA user_version = ${latest}`);
}

async function applyIdempotentMigrations(db: AppDb): Promise<void> {
  await ensureColumn(db, 'accounts', 'tracked', 'tracked INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'loans', 'rate_type', `rate_type TEXT NOT NULL DEFAULT 'fixed'`);
  await ensureColumn(db, 'loans', 'person_id', `person_id TEXT REFERENCES people(id) ON DELETE SET NULL`);
  await ensureColumn(db, 'transactions', 'loan_id', `loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE`);
  await ensureColumn(db, 'loans', 'asset_label', `asset_label TEXT`);
  await ensureColumn(db, 'loans', 'asset_value_minor', `asset_value_minor INTEGER`);
  const addedIsSensitive = await ensureColumn(
    db,
    'categories',
    'is_sensitive',
    `is_sensitive INTEGER NOT NULL DEFAULT 0`
  );
  await ensureColumn(db, 'categories', 'is_system', `is_system INTEGER NOT NULL DEFAULT 0`);
  await flagSystemCategories(db);
  await remapLegacyCategoryColors(db);

  if (addedIsSensitive) {
    // One-time backfill: the two built-ins this feature needs start flagged on upgrade, as on a fresh
    // install (ledger.ts seedDefaultCategories); custom or renamed ones stay unflagged until opted in.
    await db.runAsync(
      `UPDATE categories SET is_sensitive = 1 WHERE name IN ('Savings Deposit', 'Investments')`
    );
  }

  // Fresh installs get "Friends & Family" from seedDefaultCategoriesIfEmpty (only when empty; leave that).
  // Upgrades add it here, one kind at a time, so a same-named category of one kind isn't duplicated.
  const categoryCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if ((categoryCount?.count ?? 0) > 0) {
    for (const kind of ['income', 'expense'] as const) {
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM categories WHERE name = ? AND kind = ?',
        ['Friends & Family', kind]
      );
      if (!existing) {
        const def = DEFAULT_CATEGORIES.find((c) => c.name === 'Friends & Family' && c.kind === kind)!;
        await db.runAsync(
          `INSERT INTO categories (id, name, kind, parent_id, icon, color, sort_order, is_sensitive, is_system) VALUES (?, ?, ?, NULL, ?, ?, ?, 0, ?)`,
          [newId(), def.name, def.kind, def.icon, def.color, def.sortOrder, def.system ? 1 : 0]
        );
      }
    }
  }

  await ensureColumn(db, 'savings_goals', 'note_to_self', `note_to_self TEXT`);
  await ensureColumn(db, 'savings_goals', 'letter_revealed', `letter_revealed INTEGER NOT NULL DEFAULT 0`);
  await ensureColumn(db, 'savings_goals', 'track_account', `track_account INTEGER NOT NULL DEFAULT 0`);
  // Null on existing rules, not backfilled from next_run_date: a drifted rule (31st → 3rd) would lock in
  // the drifted day, and null already falls back to that day at run time (see runDueRecurringRules).
  await ensureColumn(db, 'recurring_rules', 'anchor_day', `anchor_day INTEGER`);

  await ensureColumn(
    db,
    'transactions',
    'loan_tx_kind',
    `loan_tx_kind TEXT CHECK (loan_tx_kind IN ('disbursement','fee','prepayment','prepayment_charge'))`
  );
  await db.runAsync(BACKFILL_LOAN_TX_KIND_SQL);

  // Split payments: parts share a split_id.
  await ensureColumn(db, 'transactions', 'split_id', 'split_id TEXT');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_split ON transactions(split_id)');

  // Refunds: money back that lowers a category's spending (db/spendSql.ts).
  await ensureColumn(db, 'transactions', 'is_refund', 'is_refund INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'transactions', 'day_rank', 'day_rank INTEGER');

  await repairLoanDueDates(db);
}

/**
 * Old month math overflowed missing days (Jan 31 + 1 month = Mar 3), misdating pending installments of loans
 * due 29–31. Rewrites pending ones to #1 + (n − 1) months, clamped; paid kept. Idempotent; no-op for 1–28.
 */
async function repairLoanDueDates(db: AppDb): Promise<void> {
  const rows = await db.getAllAsync<{
    id: string;
    installment_number: number;
    due_date: string;
    anchor: string;
  }>(
    `SELECT lp.id AS id, lp.installment_number AS installment_number, lp.due_date AS due_date, anchor_row.due_date AS anchor
     FROM loan_payments lp
     JOIN loan_payments anchor_row ON anchor_row.loan_id = lp.loan_id AND anchor_row.installment_number = 1
     WHERE lp.status = 'pending' AND CAST(substr(anchor_row.due_date, 9, 2) AS INTEGER) > 28`
  );
  for (const row of rows) {
    const expected = addMonthsToIsoDate(row.anchor, row.installment_number - 1);
    if (expected !== row.due_date) {
      await db.runAsync('UPDATE loan_payments SET due_date = ? WHERE id = ?', [expected, row.id]);
    }
  }
}

/**
 * Resolves to the one shared db handle, running first-launch setup (file move, tables, columns, seeds) once.
 * The in-flight promise is cached so concurrent first calls can't double-seed; failure clears it for retry.
 */
export function getDb(): Promise<AppDb> {
  if (!dbSetup) {
    dbSetup = initDb().catch((e) => {
      dbSetup = null;
      throw e;
    });
  }
  return dbSetup;
}

async function initDb(): Promise<AppDb> {
  await migrateDbFilename();
  const raw = await SQLite.openDatabaseAsync(DB_NAME);
  const unqueued = toAppDb(raw);
  await unqueued.execAsync('PRAGMA foreign_keys = ON;');
  // The home-screen widget and the app can both hold this file open; wait a few seconds for the other's write instead of failing at once with "database is locked".
  await unqueued.execAsync('PRAGMA busy_timeout = 5000;');
  await unqueued.execAsync(CREATE_TABLES_SQL);
  // One transaction for the whole batch: a failure partway rolls every migration back instead of leaving an
  // install half-migrated (column added, backfill never run — ensureColumn wouldn't retry).
  await unqueued.withTransactionAsync((tx) => runMigrations(tx));
  await seedDefaultCategoriesIfEmpty(unqueued);
  // Recently deleted keeps entries for 30 days; anything older goes as the app opens.
  await purgeExpiredDeletedEntries(unqueued);

  const currencyRow = await unqueued.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'default_currency'"
  );
  primeCurrencyCache(currencyRow?.value ?? null);

  // Setup above runs once, before any screen can call getDb(), so nothing needs serializing yet;
  // every call after this goes through the queue.
  return serializeDb(raw);
}

async function seedDefaultCategoriesIfEmpty(db: AppDb) {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (row && row.count > 0) return;

  await db.withTransactionAsync(async (tx) => {
    for (const cat of DEFAULT_CATEGORIES) {
      await tx.runAsync(
        `INSERT INTO categories (id, name, kind, parent_id, icon, color, sort_order, is_sensitive, is_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          cat.name,
          cat.kind,
          null,
          cat.icon,
          cat.color,
          cat.sortOrder,
          cat.sensitive ? 1 : 0,
          cat.system ? 1 : 0,
        ]
      );
    }
  });
}
