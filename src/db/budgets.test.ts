/**
 * Category budgets against a real SQLite engine: spend aggregation, the
 * `rollover` carry-forward math, "continue this budget" lapsed detection,
 * and the delete/undo round trip — all against the schema's real
 * `UNIQUE (category_id, period_month)` shape.
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
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import {
  createBudget,
  updateBudget,
  deleteBudget,
  restoreBudget,
  listBudgetsForMonth,
  listLapsedBudgets,
  periodMonthOf,
} from '@/db/budgets';

describe('budgets', () => {
  let accountId: string;
  let foreignAccountId: string;
  let groceriesId: string;
  let diningId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
    // A different-currency account — its spend must never count toward a
    // budget, same as every other report figure in the app.
    foreignAccountId = (
      await createAccount({ name: 'Travel USD', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })
    ).id;
    groceriesId = (await createCategory({ name: 'Groceries', kind: 'expense' })).id;
    diningId = (await createCategory({ name: 'Dining Out', kind: 'expense' })).id;
  });

  it('creates a budget and rejects a second one for the same category+month', async () => {
    const budget = await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 500000,
      rollover: false,
      periodMonth: '2026-01',
    });
    expect(budget.categoryId).toBe(groceriesId);
    expect(budget.periodMonth).toBe('2026-01');
    expect(budget.limitAmountMinor).toBe(500000);

    await expect(
      createBudget({
        categoryId: groceriesId,
        limitAmountMinor: 100000,
        rollover: false,
        periodMonth: '2026-01',
      })
    ).rejects.toThrow('already has a budget');
  });

  it('rejects a non-positive limit', async () => {
    await expect(
      createBudget({ categoryId: diningId, limitAmountMinor: 0, rollover: false, periodMonth: '2026-01' })
    ).rejects.toThrow('positive amount');
  });

  it('computes spend for the month, scoped to the default-currency account only', async () => {
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: groceriesId,
      amountMinor: 410000,
      date: '2026-01-05',
    });
    // Same category, same month, but a foreign-currency account — excluded.
    await createTransaction({
      type: 'expense',
      accountId: foreignAccountId,
      categoryId: groceriesId,
      amountMinor: 999900,
      date: '2026-01-06',
    });
    // Same category, different month — excluded.
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: groceriesId,
      amountMinor: 100000,
      date: '2025-12-20',
    });

    const [progress] = await listBudgetsForMonth('2026-01');
    expect(progress.categoryName).toBe('Groceries');
    expect(progress.spentMinor).toBe(410000);
    expect(progress.effectiveLimitMinor).toBe(500000);
    expect(progress.remainingMinor).toBe(90000);
    expect(progress.overBudget).toBe(false);
    expect(progress.percentUsed).toBeCloseTo(82, 0);
  });

  it('flags overBudget once spend passes the limit', async () => {
    const budget = await createBudget({
      categoryId: diningId,
      limitAmountMinor: 300000,
      rollover: false,
      periodMonth: '2026-02',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: diningId,
      amountMinor: 324000,
      date: '2026-02-10',
    });
    const [progress] = await listBudgetsForMonth('2026-02');
    expect(progress.budget.id).toBe(budget.id);
    expect(progress.spentMinor).toBe(324000);
    expect(progress.overBudget).toBe(true);
    expect(progress.remainingMinor).toBe(-24000);
  });

  it("rollover carries last month's unspent amount into this month's effective limit", async () => {
    // March: ₹5,000 budgeted, ₹3,000 spent — ₹2,000 unspent.
    await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 500000,
      rollover: true,
      periodMonth: '2026-03',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: groceriesId,
      amountMinor: 300000,
      date: '2026-03-05',
    });
    // April: ₹5,000 budgeted again, with rollover on — effective limit should be ₹7,000.
    await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 500000,
      rollover: true,
      periodMonth: '2026-04',
    });

    const april = (await listBudgetsForMonth('2026-04')).find((p) => p.budget.periodMonth === '2026-04')!;
    expect(april.effectiveLimitMinor).toBe(700000);
  });

  it('rollover never carries a negative amount (an over-spent prior month adds nothing)', async () => {
    await createBudget({
      categoryId: diningId,
      limitAmountMinor: 200000,
      rollover: true,
      periodMonth: '2026-05',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: diningId,
      amountMinor: 350000,
      date: '2026-05-15',
    });
    await createBudget({
      categoryId: diningId,
      limitAmountMinor: 200000,
      rollover: true,
      periodMonth: '2026-06',
    });

    const june = (await listBudgetsForMonth('2026-06')).find((p) => p.budget.periodMonth === '2026-06')!;
    expect(june.effectiveLimitMinor).toBe(200000);
  });

  it('sorts most-urgent (highest percent used) first', async () => {
    await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 1000000,
      rollover: false,
      periodMonth: '2026-07',
    });
    await createBudget({
      categoryId: diningId,
      limitAmountMinor: 100000,
      rollover: false,
      periodMonth: '2026-07',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: groceriesId,
      amountMinor: 100000, // 10%
      date: '2026-07-02',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: diningId,
      amountMinor: 90000, // 90%
      date: '2026-07-02',
    });
    const list = await listBudgetsForMonth('2026-07');
    expect(list[0].categoryName).toBe('Dining Out');
    expect(list[1].categoryName).toBe('Groceries');
  });

  it('lists lapsed budgets — a category budgeted last month but not this one', async () => {
    await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 500000,
      rollover: true,
      periodMonth: '2026-08',
    });
    const lapsed = await listLapsedBudgets('2026-09');
    expect(lapsed).toHaveLength(1);
    expect(lapsed[0]).toMatchObject({ categoryId: groceriesId, limitAmountMinor: 500000, rollover: true });

    // Once continued, it's no longer lapsed.
    await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 500000,
      rollover: true,
      periodMonth: '2026-09',
    });
    expect(await listLapsedBudgets('2026-09')).toHaveLength(0);
  });

  it('updateBudget changes the limit and rollover flag without touching category/month', async () => {
    const budget = await createBudget({
      categoryId: diningId,
      limitAmountMinor: 100000,
      rollover: false,
      periodMonth: '2026-10',
    });
    await updateBudget(budget.id, { limitAmountMinor: 150000, rollover: true });
    const [updated] = await listBudgetsForMonth('2026-10');
    expect(updated.budget.limitAmountMinor).toBe(150000);
    expect(updated.budget.rollover).toBe(true);
  });

  it('deletes a budget and restores it via the undo snapshot, unchanged', async () => {
    const budget = await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 250000,
      rollover: false,
      periodMonth: '2026-11',
    });
    const snapshot = await deleteBudget(budget.id);
    expect(await listBudgetsForMonth('2026-11')).toHaveLength(0);

    await restoreBudget(snapshot);
    const [restored] = await listBudgetsForMonth('2026-11');
    expect(restored.budget.id).toBe(budget.id);
    expect(restored.budget.limitAmountMinor).toBe(250000);
  });

  it('deleteBudget on an already-deleted id throws instead of returning a bogus snapshot', async () => {
    const budget = await createBudget({
      categoryId: diningId,
      limitAmountMinor: 100000,
      rollover: false,
      periodMonth: '2026-12',
    });
    await deleteBudget(budget.id);
    await expect(deleteBudget(budget.id)).rejects.toThrow('already deleted');
  });

  it('periodMonthOf formats a date as its local YYYY-MM', () => {
    expect(periodMonthOf(new Date(2026, 0, 15))).toBe('2026-01');
    expect(periodMonthOf(new Date(2026, 10, 3))).toBe('2026-11');
  });
});
