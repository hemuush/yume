/**
 * Every query that lists a subcategory also hands back its parent's name, so
 * two same-named subcategories (here "Flipkart Minutes" under Food & Dining
 * and under Groceries) can be told apart on screen; and Activity's search
 * finds an entry by its parent's name.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  getRepeatEntries,
  searchTransactions,
} from '@/db/ledger';
import { createBudget, listBudgetsForMonth } from '@/db/budgets';

describe('parent category names', () => {
  let bankId: string;
  let foodId: string;
  let groceriesId: string;
  let flipFoodId: string;
  let flipGroceriesId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    bankId = (
      await createAccount({ name: 'HDFC Savings', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    foodId = (await createCategory({ name: 'Food & Dining', kind: 'expense' })).id;
    groceriesId = (await createCategory({ name: 'Groceries', kind: 'expense' })).id;
    flipFoodId = (await createCategory({ name: 'Flipkart Minutes', kind: 'expense', parentId: foodId })).id;
    flipGroceriesId = (
      await createCategory({ name: 'Flipkart Minutes', kind: 'expense', parentId: groceriesId })
    ).id;

    for (const [categoryId, amountMinor] of [
      [flipFoodId, 21000],
      [flipGroceriesId, 33000],
      [foodId, 9000],
    ] as const) {
      // Twice each: "Your usual" only lists what was logged more than once.
      for (const date of ['2026-09-20', '2026-09-21']) {
        await createTransaction({
          type: 'expense',
          accountId: bankId,
          categoryId,
          amountMinor,
          date,
          note: '',
        });
      }
    }
    await createBudget({
      categoryId: flipFoodId,
      limitAmountMinor: 100000,
      rollover: false,
      periodMonth: '2026-09',
    });
  });

  it('search finds a subcategory entry by its parent name, and by its own', async () => {
    const byParent = await searchTransactions('Food & Dining', 50, '2026-10-03');
    expect([...new Set(byParent.map((t) => t.categoryId))].sort()).toEqual([flipFoodId, foodId].sort());

    const byOwnName = await searchTransactions('Flipkart', 50, '2026-10-03');
    expect([...new Set(byOwnName.map((t) => t.categoryId))].sort()).toEqual(
      [flipFoodId, flipGroceriesId].sort()
    );
  });

  it('a budget on a subcategory carries its parent name; a top-level one has none', async () => {
    await createBudget({
      categoryId: groceriesId,
      limitAmountMinor: 500000,
      rollover: false,
      periodMonth: '2026-09',
    });
    const list = await listBudgetsForMonth('2026-09');
    const sub = list.find((b) => b.budget.categoryId === flipFoodId);
    const top = list.find((b) => b.budget.categoryId === groceriesId);
    expect(sub?.categoryName).toBe('Flipkart Minutes');
    expect(sub?.parentName).toBe('Food & Dining');
    expect(top?.parentName ?? null).toBeNull();
  });

  it('"Your usual" entries name the parent of each same-named subcategory', async () => {
    const usual = await getRepeatEntries(10, '2026-10-03', 'expense');
    const names = usual
      .filter((u) => u.categoryName === 'Flipkart Minutes')
      .map((u) => u.parentName)
      .sort();
    expect(names).toEqual(['Food & Dining', 'Groceries']);
    expect(usual.find((u) => u.categoryId === foodId)?.parentName).toBeNull();
  });
});

afterAll(() => new Promise((resolve) => setTimeout(resolve, 800)));
