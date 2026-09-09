import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { newId } from '@/lib/id';
import { primeCurrencyCache } from './settings';

const DB_NAME = 'flynse.db';

/**
 * The app-facing db handle — deliberately its own type rather than
 * `SQLite.SQLiteDatabase`, because `withTransactionAsync` here has a
 * different contract: it hands its callback a `tx` argument for nested
 * calls (see serializeDb below for why). Only the methods actually called
 * anywhere in this codebase are included; the test harness
 * (scripts/realDataTestDb.ts's AsyncDb) mirrors this exact shape so
 * `getDb()` can be mocked identically in both.
 */
export interface AppDb {
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  runAsync(sql: string, params?: any[]): Promise<void>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: (tx: AppDb) => Promise<void>): Promise<void>;
}

let dbInstance: AppDb | null = null;

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
  };
  return self;
}

/**
 * expo-sqlite's native module does not reliably serialize concurrent async
 * calls issued from unrelated code paths (e.g. two screens each running
 * their own Promise.all of report queries at once — completely normal
 * here, since every screen loads its data in parallel): overlapping calls
 * can race and fail with a native "NativeDatabase.prepareAsync ... not an
 * error" rejection, or worse, silently return wrong/empty results without
 * throwing at all. Every db method the app calls is routed through this
 * queue so only one statement is ever in flight on the shared connection,
 * regardless of how many screens call getDb() at once.
 *
 * withTransactionAsync is the one exception, and deliberately so: its
 * callback receives the *raw*, unqueued connection as `tx`, and every
 * caller must use `tx` (never the outer `db`) for nested calls inside a
 * transaction. An earlier version of this file used a "call depth" counter
 * to decide whether to bypass the queue instead — that counter was a
 * single global flag, so it couldn't actually tell "a nested call from
 * within this same transaction" apart from "an unrelated call that
 * happens to be in flight at the same moment" (both look identical as
 * "some task is running"). That's not a hypothetical: it let an unrelated
 * query run concurrently with an open transaction on the same connection,
 * corrupting results without ever throwing — which is how Profile's stats
 * silently came back as all zeros despite real data existing. Passing
 * `tx` explicitly removes the ambiguity: nested calls always go straight
 * to the raw connection (safe, since nothing else can run until the
 * transaction's own promise settles and the queue moves on to its next
 * entry), and anything NOT called via `tx` genuinely is unrelated and must
 * wait its turn in the queue.
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
  };
}

/**
 * CREATE TABLE IF NOT EXISTS only helps fresh installs — an already-created
 * table on an existing install never picks up a newly added column. This
 * adds one if missing, so schema changes reach upgraded installs too.
 */
/** Returns true only when the column was actually just added (fresh installs already have it via CREATE_TABLES_SQL and never hit this branch), so callers can run a one-time backfill exactly once. */
async function ensureColumn(db: AppDb, table: string, column: string, ddl: string): Promise<boolean> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (cols.some((c) => c.name === column)) return false;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  return true;
}

/**
 * Flags the built-in categories the app matches by name (Loan EMI, Loan
 * Repayment, Fees & Charges, Friends & Family — see src/features/loans/*,
 * src/features/PeopleSection.tsx, app/add-historical.tsx) as `is_system` so
 * they can't be deleted / archived / renamed out from under that match.
 *
 * Idempotent, run on every startup. `restoreFromSnapshot` in src/lib/backup.ts
 * repeats the same UPDATE inline (a backup taken before this column existed
 * brings the built-ins back unflagged, and restore doesn't re-run
 * migrations). Scoped to still-unflagged top-level rows named exactly as
 * seeded, so a user's own same-named category, or one they've since renamed,
 * is never touched.
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

async function runMigrations(db: AppDb): Promise<void> {
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

  if (addedIsSensitive) {
    // One-time backfill for an upgrading install: the two built-in categories
    // this feature exists for start flagged, same as a fresh install gets via
    // src/db/ledger.ts's seedDefaultCategories. Anything else (custom
    // categories, or these two if the user later renamed them) stays
    // unflagged until the user opts it in themselves.
    await db.runAsync(
      `UPDATE categories SET is_sensitive = 1 WHERE name IN ('Savings Deposit', 'Investments')`
    );
  }

  // "Friends & Family" was added to DEFAULT_CATEGORIES so a fresh install
  // gets it automatically via seedDefaultCategoriesIfEmpty (which runs right
  // after this function, and only when the table is still empty — never
  // touch that path here). An already-seeded, upgrading install needs it
  // added explicitly instead, one kind at a time so a user who already has
  // a same-named category of only one kind doesn't get a duplicate of it.
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
}

export async function getDb(): Promise<AppDb> {
  if (dbInstance) return dbInstance;
  const raw = await SQLite.openDatabaseAsync(DB_NAME);
  const unqueued = toAppDb(raw);
  await unqueued.execAsync('PRAGMA foreign_keys = ON;');
  await unqueued.execAsync(CREATE_TABLES_SQL);
  await runMigrations(unqueued);
  await seedDefaultCategoriesIfEmpty(unqueued);

  const currencyRow = await unqueued.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'default_currency'"
  );
  primeCurrencyCache(currencyRow?.value ?? null);

  // Setup above runs once, sequentially, before any screen can call getDb()
  // — nothing to serialize yet. Every call after this point goes through
  // the queue, since multiple screens/components can call getDb() at once.
  dbInstance = serializeDb(raw);
  return dbInstance;
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

// Test-only / reset helper. Never call from production UI flows.
export async function _resetDatabase() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM loan_payments;
    DELETE FROM loans;
    DELETE FROM transactions;
    DELETE FROM budgets;
    DELETE FROM recurring_rules;
    DELETE FROM savings_goals;
    DELETE FROM categories;
    DELETE FROM accounts;
  `);
  await seedDefaultCategoriesIfEmpty(db);
}
