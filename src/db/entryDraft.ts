import { onSettingsRestored } from '@/lib/dataEvents';
import { getDb } from './client';
import {
  ENTRY_DRAFT_KEY,
  parseEntryDraft,
  serializeEntryDraft,
  type EntryDraft,
} from '@/features/add/entryDraft';

// Order writes so an older autosave cannot resurrect a draft cleared after Save or Discard.
let writes: Promise<unknown> = Promise.resolve();
export async function readEntryDraft(): Promise<EntryDraft | null> {
  await writes;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    ENTRY_DRAFT_KEY,
  ]);
  return parseEntryDraft(row?.value ?? null);
}
export function writeEntryDraft(draft: EntryDraft | null): Promise<void> {
  const raw = draft ? serializeEntryDraft(draft) : null;
  const run = writes.then(async () => {
    const db = await getDb();
    if (raw === null) await db.runAsync('DELETE FROM settings WHERE key = ?', [ENTRY_DRAFT_KEY]);
    else
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [ENTRY_DRAFT_KEY, raw]
      );
  });
  writes = run.catch(() => {});
  return run;
}

// A restore can overtake an already queued autosave. Queue the clear last as well as suspending the hook.
onSettingsRestored(() => {
  void writeEntryDraft(null).catch(() => {});
});
