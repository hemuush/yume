import { draftReferencesAvailable } from './draftReferences';
import type { EntryDraft } from './entryDraft';

const draft: EntryDraft = {
  type: 'expense',
  expr: '',
  date: '2026-10-21',
  note: '',
  accountId: 'bank',
  toAccountId: null,
  categoryId: 'food',
  paymentMode: null,
  personId: null,
  friendAccountId: null,
  friendSign: 1,
  refund: false,
  rows: [],
  splitParts: null,
};
const data = {
  accounts: [
    { id: 'bank', archived: false },
    { id: 'old', archived: true },
  ],
  categories: [
    { id: 'food', archived: false },
    { id: 'archived', archived: true },
  ],
  people: [{ id: 'friend' }],
};

it('accepts incomplete selections for editing and ignores inactive mode references', () => {
  expect(draftReferencesAvailable({ ...draft, accountId: null, categoryId: null }, data)).toBe(true);
  expect(draftReferencesAvailable({ ...draft, personId: 'missing', toAccountId: 'old' }, data)).toBe(true);
  expect(
    draftReferencesAvailable(
      { ...draft, type: 'friend', categoryId: 'missing', accountId: 'old', personId: 'friend' },
      data
    )
  ).toBe(true);
});
it.each([
  { accountId: 'old' },
  { categoryId: 'archived' },
  { type: 'transfer', toAccountId: 'missing' },
  { type: 'friend', personId: 'missing' },
  { type: 'friend', friendAccountId: 'old' },
  { splitParts: [{ key: 'one', categoryId: 'missing', amountText: '10' }] },
] as Partial<EntryDraft>[])('blocks unavailable references used by the active entry (%j)', (change) => {
  expect(draftReferencesAvailable({ ...draft, ...change }, data)).toBe(false);
});
it('checks actual split categories instead of an unused single-category selection', () => {
  expect(
    draftReferencesAvailable(
      {
        ...draft,
        categoryId: 'archived',
        splitParts: [{ key: 'one', categoryId: 'food', amountText: '10' }],
      },
      data
    )
  ).toBe(true);
});
it('validates each staged entry even when it belongs to a different mode', () => {
  const row: EntryDraft['rows'][number] = {
    id: 'row',
    kind: 'friend',
    personId: 'friend',
    personName: 'Friend',
    accountId: null,
    accountName: null,
    sign: 1,
    amountMinor: 100,
    date: draft.date,
    note: '',
  };
  expect(draftReferencesAvailable({ ...draft, rows: [row] }, data)).toBe(true);
  expect(draftReferencesAvailable({ ...draft, rows: [{ ...row, personId: 'missing' }] }, data)).toBe(false);
});
