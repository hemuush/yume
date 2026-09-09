// A better-sqlite3-backed adapter matching the exact async method surface the
// app's src/db/*.ts files call on their expo-sqlite handle. This lets the
// app's REAL, unmodified query/business logic run against a real SQLite
// engine outside the Expo/RN runtime, so it can be exercised with real user
// data from a terminal script instead of only on-device.
import Database from 'better-sqlite3';

export interface AsyncDb {
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  runAsync(sql: string, params?: any[]): Promise<void>;
  execAsync(sql: string): Promise<void>;
  // Matches src/db/client.ts's AppDb contract exactly: the callback
  // receives `tx` (here, just this same db — better-sqlite3 has no real
  // concurrency to guard against) so app code written against the real
  // queued/unqueued split runs unmodified against this test harness.
  withTransactionAsync(fn: (tx: AsyncDb) => Promise<void>): Promise<void>;
}

export function createRealDataTestDb(): AsyncDb {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const asyncDb: AsyncDb = {
    async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
      const row = db.prepare(sql).get(...params);
      return (row as T) ?? null;
    },
    async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[];
    },
    async runAsync(sql: string, params: any[] = []): Promise<void> {
      db.prepare(sql).run(...params);
    },
    async execAsync(sql: string): Promise<void> {
      db.exec(sql);
    },
    async withTransactionAsync(fn: (tx: AsyncDb) => Promise<void>): Promise<void> {
      // better-sqlite3's own db.transaction() wrapper requires a synchronous
      // function; the app's callbacks are async (they call other *Async
      // methods against this same db), so BEGIN/COMMIT/ROLLBACK are driven
      // by hand instead to preserve real async/await semantics.
      db.exec('BEGIN');
      try {
        await fn(asyncDb);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return asyncDb;
}
