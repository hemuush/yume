/** The budget-month note's decision on a real SQLite engine; the note itself is shown by the provider. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { createBudget } from '@/db/budgets';
import { getMilestonesSeen, resetSettingsCache } from '@/db/settings';
import type { MilestoneCopy } from '@/lib/milestones';
import { checkClosedBudgetMonth, showClosedBudgetMonth } from './MilestoneNote';

describe('checkClosedBudgetMonth', () => {
  const now = new Date(2026, 9, 3);
  let food = '';
  let travel = '';

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const accountId = (
      await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    travel = (await createCategory({ name: 'Travel', kind: 'expense' })).id;
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: food,
      amountMinor: 300000,
      date: '2026-09-05',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: travel,
      amountMinor: 900000,
      date: '2026-08-05',
    });
  });

  beforeEach(async () => {
    await mockTestDb.runAsync("DELETE FROM settings WHERE key = 'milestones_seen'");
    await mockTestDb.runAsync('DELETE FROM budgets');
    resetSettingsCache();
  });

  it('notes a month that closed with every budget under its limit, once', async () => {
    await createBudget({
      categoryId: food,
      limitAmountMinor: 500000,
      rollover: false,
      periodMonth: '2026-09',
    });
    const first = await checkClosedBudgetMonth(now, false);
    expect(first?.body).toBe('Your budget held.');
    expect(first?.title).toMatch(/closed under budget$/);
    expect(await getMilestonesSeen()).toContain('budgets:2026-09');
    expect(await checkClosedBudgetMonth(now, false)).toBeNull();
  });

  it('stays quiet when a budget went over, and says nothing for being over later', async () => {
    await createBudget({
      categoryId: food,
      limitAmountMinor: 200000,
      rollover: false,
      periodMonth: '2026-09',
    });
    expect(await checkClosedBudgetMonth(now, false)).toBeNull();
    expect(await getMilestonesSeen()).toEqual([]);
  });

  it('stays quiet with no budgets, or nothing spent from them', async () => {
    expect(await checkClosedBudgetMonth(now, false)).toBeNull();
    await createBudget({
      categoryId: travel,
      limitAmountMinor: 500000,
      rollover: false,
      periodMonth: '2026-09',
    });
    expect(await checkClosedBudgetMonth(now, false)).toBeNull();
  });
  it('marks a month seen only after the note was actually shown', async () => {
    await createBudget({
      categoryId: food,
      limitAmountMinor: 500000,
      rollover: false,
      periodMonth: '2026-09',
    });
    // The note could not be shown (the watcher was torn down): nothing is recorded, so it is offered again.
    const dropped = jest.fn((_copy: MilestoneCopy) => false);
    expect(await showClosedBudgetMonth(now, false, dropped)).toBe(false);
    expect(dropped).toHaveBeenCalledTimes(1);
    expect(await getMilestonesSeen()).toEqual([]);

    const shown = jest.fn((_copy: MilestoneCopy) => true);
    expect(await showClosedBudgetMonth(now, false, shown)).toBe(true);
    expect(shown.mock.calls[0][0].body).toBe('Your budget held.');
    expect(await getMilestonesSeen()).toContain('budgets:2026-09');

    const again = jest.fn((_copy: MilestoneCopy) => true);
    expect(await showClosedBudgetMonth(now, false, again)).toBe(false);
    expect(again).not.toHaveBeenCalled();
  });
});
