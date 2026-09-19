/**
 * getDailyGoalStreakSeries against a real SQLite engine — same reasoning as
 * reportsLiveQueries.test.ts: the pure streak math (gardenGrowth.test.ts)
 * doesn't touch SQL, so this is what actually catches a broken query.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getDailyGoalStreakSeries } from '@/db/reports';

describe('getDailyGoalStreakSeries', () => {
  let accountId: string;
  let categoryId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const account = await createAccount({
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    accountId = account.id;
    const food = await createCategory({ name: 'Food', kind: 'expense' });
    categoryId = food.id;

    // Goal is 500. Jan 1-2 under, Jan 3 over (breaks the streak), Jan 4-5 under again, Jan 6 nothing spent.
    await createTransaction({ type: 'expense', accountId, categoryId, amountMinor: 300, date: '2026-01-01' });
    await createTransaction({ type: 'expense', accountId, categoryId, amountMinor: 500, date: '2026-01-02' });
    await createTransaction({ type: 'expense', accountId, categoryId, amountMinor: 900, date: '2026-01-03' });
    await createTransaction({ type: 'expense', accountId, categoryId, amountMinor: 100, date: '2026-01-04' });
    await createTransaction({ type: 'expense', accountId, categoryId, amountMinor: 200, date: '2026-01-05' });
  });

  it('builds a per-day streak that resets on an over-goal day', async () => {
    const series = await getDailyGoalStreakSeries(500, 6, '2026-01-06');
    expect(series.map((p) => p.date)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
    ]);
    expect(series.map((p) => p.streakDays)).toEqual([1, 2, 0, 1, 2, 3]);
  });

  it('a day with no spending at all counts as under the goal', async () => {
    const series = await getDailyGoalStreakSeries(500, 1, '2026-01-06');
    expect(series).toEqual([{ date: '2026-01-06', streakDays: 3 }]);
  });

  it('never counts a day before the earliest transaction on record, even asking further back', async () => {
    // The lookback window (days + 55) reaches well before 2026-01-01, the
    // earliest transaction seeded above — those pre-history days must not
    // silently read as "kept" just because no row exists for them.
    const series = await getDailyGoalStreakSeries(500, 6, '2026-01-02');
    expect(series.map((p) => p.streakDays)).toEqual([0, 0, 0, 0, 1, 2]);
  });

  it('a window asked for entirely before the earliest transaction shows no streak at all', async () => {
    const series = await getDailyGoalStreakSeries(500, 3, '2025-06-01');
    expect(series.map((p) => p.streakDays)).toEqual([0, 0, 0]);
  });
});
