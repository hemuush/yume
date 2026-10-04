import { createTransaction } from '@/db/ledger';
import { addLedgerEntry, recordMoneyGivenToPerson, recordMoneyReceivedFromPerson } from '@/db/people';
import type { Category } from '@/types';
import type { Staged } from './addEntry';
import { formatTyped, saveButtonTitle, persistStaged, stagedTotals } from './saveEntry';

jest.mock('@/db/ledger', () => ({ createTransaction: jest.fn(async () => ({ id: 'tx1' })) }));
jest.mock('@/db/people', () => ({
  addLedgerEntry: jest.fn(async () => undefined),
  recordMoneyGivenToPerson: jest.fn(async () => undefined),
  recordMoneyReceivedFromPerson: jest.fn(async () => undefined),
}));

const cat = (id: string, kind: 'expense' | 'income', name: string) => ({ id, kind, name }) as Category;
const categories = [
  cat('e1', 'expense', 'Food'),
  cat('e2', 'expense', 'Miscellaneous'),
  cat('i1', 'income', 'Other Income'),
  cat('f1', 'expense', 'Friends & Family'),
];

const friend = (over: Partial<Extract<Staged, { kind: 'friend' }>>): Staged => ({
  id: 'r',
  kind: 'friend',
  personId: 'p1',
  personName: 'Sam',
  sign: 1,
  accountId: 'a1',
  accountName: 'Bank',
  amountMinor: 500,
  date: '2026-10-03',
  note: '',
  ...over,
});

const tx = (type: 'expense' | 'income' | 'transfer', amountMinor: number): Staged =>
  ({
    id: 'r',
    kind: 'transaction',
    type,
    accountId: 'a1',
    toAccountId: null,
    categoryId: 'e1',
    label: 'x',
    categoryIcon: 'x',
    categoryColor: '#000',
    amountMinor,
    date: '2026-10-03',
    note: '',
  }) as Staged;

beforeEach(() => jest.clearAllMocks());

describe('formatTyped', () => {
  it('groups the whole part and shows decimals rounded to the whole unit that will be saved', () => {
    const grouped = (n: number) => new Intl.NumberFormat(undefined).format(n);
    expect(formatTyped('')).toBe('0');
    expect(formatTyped('1500')).toBe(grouped(1500));
    expect(formatTyped('12.')).toBe('12');
    expect(formatTyped('.5')).toBe('1');
    expect(formatTyped('1250.4')).toBe(grouped(1250));
    expect(formatTyped('1250.5')).toBe(grouped(1251));
  });
});

describe('stagedTotals', () => {
  it('sums money in and out, counting a friend entry by which way cash moved', () => {
    const rows = [
      tx('income', 1000),
      tx('expense', 300),
      tx('transfer', 999),
      friend({ sign: 1 }),
      friend({ sign: -1, amountMinor: 200 }),
    ];
    expect(stagedTotals(rows)).toEqual({ income: 1200, expense: 800 });
  });

  it('ignores a friend entry that moved no cash', () => {
    expect(stagedTotals([friend({ accountId: null })])).toEqual({ income: 0, expense: 0 });
  });
});

describe('persistStaged', () => {
  it('saves a plain entry and returns its id', async () => {
    expect(await persistStaged(tx('expense', 300), categories)).toBe('tx1');
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 300, isRefund: false })
    );
  });

  it('files money given to a friend under Friends & Family', async () => {
    expect(await persistStaged(friend({ sign: 1 }), categories)).toBeNull();
    expect(recordMoneyGivenToPerson).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'f1' }));
  });

  it('falls back to Other Income for money received when there is no Friends & Family income category', async () => {
    await persistStaged(friend({ sign: -1 }), categories);
    expect(recordMoneyReceivedFromPerson).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'i1' }));
  });

  it('records a ledger-only entry signed when no account is involved', async () => {
    await persistStaged(friend({ accountId: null, sign: -1 }), categories);
    expect(addLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: -500 }));
  });

  it('refuses a friend entry when no category of that kind exists', async () => {
    await expect(persistStaged(friend({ sign: -1 }), [cat('e1', 'expense', 'Food')])).rejects.toThrow(
      'No category available'
    );
  });
});

describe('saveButtonTitle', () => {
  const base = {
    saving: false,
    editing: false,
    split: false,
    refund: false,
    repeatWarning: false,
    rowCount: 0,
  };

  it('says what state it is in before what it will save', () => {
    expect(saveButtonTitle({ ...base, saving: true, editing: true })).toBe('Saving…');
    expect(saveButtonTitle({ ...base, editing: true, split: true })).toBe('Save changes');
    expect(saveButtonTitle({ ...base, split: true, rowCount: 2 })).toBe('Save split');
  });

  it('names a refund only while no list is being built', () => {
    expect(saveButtonTitle({ ...base, refund: true })).toBe('Save refund');
    expect(saveButtonTitle({ ...base, refund: true, rowCount: 2 })).toBe('Save 2 entries');
  });

  it('offers Save anyway after a repeat warning, ahead of the count', () => {
    expect(saveButtonTitle({ ...base, repeatWarning: true, rowCount: 3 })).toBe('Save anyway');
  });

  it('counts the list, singular for one, and falls back to Save', () => {
    expect(saveButtonTitle({ ...base, rowCount: 1 })).toBe('Save 1 entry');
    expect(saveButtonTitle({ ...base, rowCount: 4 })).toBe('Save 4 entries');
    expect(saveButtonTitle(base)).toBe('Save');
  });
});
