import type { SQLiteBindValue } from 'expo-sqlite';

/**
 * App-facing db handle: its own type, not `SQLite.SQLiteDatabase`, because `withTransactionAsync` passes a
 * `tx` to its callback (see serializeDb). Only used methods; src/test-support's AsyncDb mirrors this shape.
 */
/** One value bound to a `?` in a query — what expo-sqlite accepts. */
export type SqlParam = SQLiteBindValue;

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
