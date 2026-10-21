/**
 * Category budgets on real SQLite: spend aggregation, `rollover` carry-forward, lapsed-budget detection, and
 * the delete/undo round trip, against the real `UNIQUE (category_id, period_month)` schema.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, listTransactions } from '@/db/ledger';
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

  it('rolls back creation if reading its return value fails, so retry cannot duplicate a committed write', async () => {
    const categoryId = (await createCategory({ name: 'Atomic budget result', kind: 'expense' })).id;
    const read = mockTestDb.getFirstAsync;
    mockTestDb.getFirstAsync = async <T>(sql: string, params?: unknown[]) => {
      if (sql === 'SELECT * FROM budgets WHERE id = ?') throw new Error('result read failed');
      return read<T>(sql, params);
    };
    try {
      await expect(
        createBudget({ categoryId, periodMonth: '2030-01', limitAmountMinor: 10000, rollover: false })
      ).rejects.toThrow('result read failed');
    } finally {
      mockTestDb.getFirstAsync = read;
    }
    const created = await createBudget({
      categoryId,
      periodMonth: '2030-01',
      limitAmountMinor: 10000,
      rollover: false,
    });
    expect(created.categoryId).toBe(categoryId);
    await deleteBudget(created.id);
  });

  it('filters budget spending and refunds before the recent-entry limit', async () => {
    const categoryId = (await createCategory({ name: 'Budget entry filter', kind: 'expense' })).id;
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId,
      amountMinor: 10000,
      date: '2029-11-01',
      note: 'Purchase',
    });
    await createTransaction({
      type: 'income',
      isRefund: true,
      accountId,
      categoryId,
      amountMinor: 2000,
      date: '2029-11-02',
      note: 'Refund',
    });
    for (let i = 0; i < 4; i++)
      await createTransaction({
        type: 'income',
        accountId,
        categoryId,
        amountMinor: 1000,
        date: '2029-11-03',
        note: 'Not spending',
      });
    const entries = await listTransactions({ categoryId, spendingOnly: true, limit: 2 });
    expect(entries.map((tx) => tx.note)).toEqual(['Refund', 'Purchase']);
  });

  it('rejects income and archived categories and missing budget edits', async () => {
    const income = await createCategory({ name: 'Budget income', kind: 'income' });
    const archived = await createCategory({ name: 'Archived budget', kind: 'expense' });
    await mockTestDb.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', [archived.id]);
    for (const categoryId of [income.id, archived.id]) {
      await expect(createBudget({ categoryId, limitAmountMinor: 10000, rollover: false })).rejects.toThrow(
        /active expense category/i
      );
    }
    await expect(
      updateBudget('missing-budget', { limitAmountMinor: 10000, rollover: false })
    ).rejects.toThrow(/no longer exists/i);
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

  it('a budget on a top-level category rolls up spend logged against its subcategories too', async () => {
    const restaurantsId = (
      await createCategory({ name: 'Restaurants', kind: 'expense', parentId: groceriesId })
    ).id;
    await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 500000,
      rollover: false,
      periodMonth: '2027-01',
    });
    // Logged directly against the parent...
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: groceriesId,
      amountMinor: 100000,
      date: '2027-01-05',
    });
    // ...and one of its subcategories: both count toward the parent's budget. `categorySpend` once matched
    // `category_id` exactly, leaving a "Groceries" budget at ₹0 when all spend sat under a subcategory.
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: restaurantsId,
      amountMinor: 150000,
      date: '2027-01-06',
    });

    const progress = (await listBudgetsForMonth('2027-01'))[0];
    expect(progress.spentMinor).toBe(250000);
  });

  it("a budget on a subcategory itself stays scoped to just that subcategory's own spend", async () => {
    const suppliesId = (await createCategory({ name: 'Supplies', kind: 'expense', parentId: diningId })).id;
    await createBudget({
      categoryId: suppliesId,
      limitAmountMinor: 200000,
      rollover: false,
      periodMonth: '2027-02',
    });
    // The parent's own direct spend must not leak into a subcategory's budget.
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: diningId,
      amountMinor: 999999,
      date: '2027-02-07',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: suppliesId,
      amountMinor: 50000,
      date: '2027-02-08',
    });

    const progress = (await listBudgetsForMonth('2027-02'))[0];
    expect(progress.spentMinor).toBe(50000);
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

  it('hides a sensitive family from current, rollover and lapsed budgets without changing revealed totals', async () => {
    const parent = await createCategory({ name: 'Family privacy', kind: 'expense' });
    const privateChild = await createCategory({
      name: 'Private child',
      kind: 'expense',
      parentId: parent.id,
      isSensitive: true,
    });
    const sibling = await createCategory({ name: 'Public sibling', kind: 'expense', parentId: parent.id });
    const ordinary = await createCategory({ name: 'Public budget', kind: 'expense' });
    const privateParent = await createCategory({
      name: 'Private parent',
      kind: 'expense',
      isSensitive: true,
    });
    const inherited = await createCategory({
      name: 'Inherited child',
      kind: 'expense',
      parentId: privateParent.id,
    });
    for (const categoryId of [parent.id, privateChild.id, sibling.id, ordinary.id, inherited.id]) {
      for (const periodMonth of ['2028-01', '2028-02']) {
        await createBudget({ categoryId, periodMonth, limitAmountMinor: 100000, rollover: true });
      }
    }
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: privateChild.id,
      amountMinor: 42000,
      date: '2028-01-10',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: privateChild.id,
      amountMinor: 12000,
      date: '2028-02-10',
    });
    // Historical spending remains private even after the sensitive child is archived.
    await mockTestDb.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', [privateChild.id]);
    const hidden = await listBudgetsForMonth('2028-02', true);
    expect(hidden.map((p) => p.budget.categoryId)).toEqual([ordinary.id]);
    expect(hidden[0]).toMatchObject({ spentMinor: 0, effectiveLimitMinor: 200000, remainingMinor: 200000 });
    expect((await listLapsedBudgets('2028-03', true)).map((p) => p.categoryId)).toEqual([ordinary.id]);
    const revealed = (await listBudgetsForMonth('2028-02', false)).find(
      (p) => p.budget.categoryId === parent.id
    )!;
    expect(revealed).toMatchObject({
      spentMinor: 12000,
      effectiveLimitMinor: 158000,
      remainingMinor: 146000,
    });
    expect((await listLapsedBudgets('2028-03', false)).some((p) => p.categoryId === parent.id)).toBe(true);
  });
});
