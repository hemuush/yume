import type { AppDb } from './dbTypes';

/** How long a deleted entry is kept before it's gone for good. */
export const KEEP_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const retentionCutoff = (now: Date) => new Date(now.getTime() - KEEP_DAYS * DAY_MS).toISOString();

/**
 * Clears anything older than 30 days. Run as the app opens, so it lives apart from recentlyDeleted: the database
 * client needs it, and recentlyDeleted needs the client.
 */
export async function purgeExpiredDeletedEntries(db: AppDb, now: Date = new Date()): Promise<void> {
  await db.runAsync('DELETE FROM deleted_entries WHERE deleted_at < ?', [retentionCutoff(now)]);
}
