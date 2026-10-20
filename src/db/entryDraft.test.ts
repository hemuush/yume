import { createRealDataTestDb } from '@/test-support/realDataTestDb';
const mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
import { CREATE_TABLES_SQL } from './schema';
import { readEntryDraft, writeEntryDraft } from './entryDraft';
import { parseEntryDraft, serializeEntryDraft, type EntryDraft } from '@/features/add/entryDraft';
const draft: EntryDraft = {
  type: 'expense',
  expr: '70+200',
  accountId: 'bank',
  toAccountId: null,
  categoryId: 'food',
  note: 'Unfinished',
  paymentMode: 'upi',
  date: '2026-10-20',
  personId: null,
  friendSign: 1,
  friendAccountId: null,
  refund: false,
  rows: [],
  splitParts: [{ key: 'part-1', categoryId: 'food', amountText: '' }],
};
beforeAll(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
});
it('recovers the exact draft after a persisted read, including date, method and split', async () => {
  await writeEntryDraft(draft);
  expect(await readEntryDraft()).toEqual(draft);
  expect(await mockDb.getAllAsync('SELECT id FROM transactions')).toEqual([]);
});
it('serializes clear after older writes so a saved draft cannot reappear', async () => {
  const first = writeEntryDraft(draft);
  const clear = writeEntryDraft(null);
  await Promise.all([first, clear]);
  expect(await readEntryDraft()).toBeNull();
});
it.each([
  'bad json',
  '{"version":2}',
  serializeEntryDraft({ ...draft, date: '2026-02-31' }),
  serializeEntryDraft({ ...draft, paymentMode: 'invalid' } as unknown as EntryDraft),
])('rejects malformed recovery data (%s)', (raw) => {
  expect(parseEntryDraft(raw)).toBeNull();
});
