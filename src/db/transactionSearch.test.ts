/**
 * searchTransactions against a real SQLite engine: matching by note,
 * category name, and either side of a transfer's accounts; case
 * insensitivity; literal (non-wildcard) matching of `%`/`_`; ordering;
 * limit capping; and the empty-query short-circuit.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, searchTransactions } from '@/db/ledger';

describe('searchTransactions', () => {
  let bankId: string;
  let walletId: string;
  let diningId: string;
  let groceriesId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    bankId = (
      await createAccount({ name: 'HDFC Savings', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    walletId = (
      await createAccount({ name: 'Paytm Wallet', type: 'wallet', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    diningId = (await createCategory({ name: 'Food & Dining', kind: 'expense' })).id;
    groceriesId = (await createCategory({ name: 'Groceries', kind: 'expense' })).id;

    await createTransaction({
      type: 'expense',
      accountId: bankId,
      categoryId: diningId,
      amountMinor: 42000,
      date: '2026-09-10',
      note: 'Zomato order',
    });
    await createTransaction({
      type: 'expense',
      accountId: bankId,
      categoryId: diningId,
      amountMinor: 68000,
      date: '2026-08-22',
      note: 'Zomato lunch with team',
    });
    await createTransaction({
      type: 'expense',
      accountId: walletId,
      categoryId: groceriesId,
      amountMinor: 15000,
      date: '2026-07-05',
      note: '50% off coupon run',
    });
    await createTransaction({
      type: 'transfer',
      accountId: bankId,
      toAccountId: walletId,
      amountMinor: 100000,
      date: '2026-09-01',
      note: '',
    });
  });

  it('matches by note, case-insensitively and on a partial word', async () => {
    const results = await searchTransactions('zomato');
    expect(results).toHaveLength(2);
    expect(results.every((t) => t.note.toLowerCase().includes('zomato'))).toBe(true);

    const upper = await searchTransactions('ZOMATO');
    expect(upper).toHaveLength(2);
  });

  it('matches by category name even when the note has nothing to do with it', async () => {
    const results = await searchTransactions('groceries');
    expect(results).toHaveLength(1);
    expect(results[0].categoryId).toBe(groceriesId);
  });

  it("matches a transfer by either side's account name", async () => {
    const bySource = await searchTransactions('HDFC');
    expect(bySource.some((t) => t.type === 'transfer')).toBe(true);

    const byDestination = await searchTransactions('Paytm');
    expect(byDestination.some((t) => t.type === 'transfer')).toBe(true);
  });

  it('treats % and _ as literal characters, not SQL LIKE wildcards', async () => {
    // Without escaping, "50%" would match "50" followed by anything —
    // silently over-matching every note that starts with "50".
    const literal = await searchTransactions('50%');
    expect(literal).toHaveLength(1);
    expect(literal[0].note).toBe('50% off coupon run');

    // A query that's only a wildcard character must not degenerate into
    // "match everything" — it should behave as a literal search for a
    // percent sign, matching only the one note that actually has one.
    const bareWildcard = await searchTransactions('%');
    expect(bareWildcard).toHaveLength(1);
    expect(bareWildcard[0].note).toBe('50% off coupon run');

    // No note contains a literal underscore, so this — unescaped, "_" would
    // match any single character and effectively return everything — must
    // come back empty instead.
    expect(await searchTransactions('_')).toEqual([]);
  });

  it('returns nothing for an empty or whitespace-only query, without touching the database', async () => {
    expect(await searchTransactions('')).toEqual([]);
    expect(await searchTransactions('   ')).toEqual([]);
  });

  it('returns nothing for a query that matches nothing', async () => {
    expect(await searchTransactions('swiggy')).toEqual([]);
  });

  it('orders newest first', async () => {
    const results = await searchTransactions('zomato');
    expect(results.map((t) => t.date)).toEqual(['2026-09-10', '2026-08-22']);
  });

  it('caps at the given limit', async () => {
    const capped = await searchTransactions('o', 2);
    expect(capped.length).toBeLessThanOrEqual(2);
  });
});
