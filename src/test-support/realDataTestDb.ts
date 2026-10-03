// A better-sqlite3 adapter matching the async method surface src/db/*.ts calls on its expo-sqlite handle,
// so the app's real query logic runs on real SQLite outside the Expo/RN runtime (e.g. on real data).
import Database from 'better-sqlite3';

export interface AsyncDb {
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  runAsync(sql: string, params?: any[]): Promise<void>;
  execAsync(sql: string): Promise<void>;
  // Matches src/db/client.ts's AppDb contract: the callback gets `tx` (this same db; better-sqlite3 has no
  // concurrency to guard) so app code written for the queued/unqueued split runs unmodified.
  withTransactionAsync(fn: (tx: AsyncDb) => Promise<void>): Promise<void>;
  exclusiveAsync<T>(fn: (db: AsyncDb) => Promise<T>): Promise<T>;
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
      // better-sqlite3's db.transaction() needs a synchronous function but app callbacks are async, so
      // BEGIN/COMMIT/ROLLBACK are driven by hand to keep real async/await semantics.
      db.exec('BEGIN');
      try {
        await fn(asyncDb);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exclusiveAsync<T>(fn: (db: AsyncDb) => Promise<T>): Promise<T> {
      return fn(asyncDb);
    },
  };
  return asyncDb;
}
