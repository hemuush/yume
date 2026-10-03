/**
 * Categories come back A to Z by name, ignoring case, wherever the app lists
 * them — built-in and your own, top-level and subcategories alike — and
 * budgets follow the same order.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createCategory, listCategories, archiveCategory } from '@/db/ledger';
import { createBudget, listBudgetsForMonth } from '@/db/budgets';

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  // Seeded out of order, the way built-in defaults (sort_order 10, 11, …)
  // and categories you add later (sort_order 0) end up mixed together.
  await createCategory({ name: 'Travel', kind: 'expense', sortOrder: 27 });
  await createCategory({ name: 'Food & Dining', kind: 'expense', sortOrder: 10 });
  await createCategory({ name: 'zomato', kind: 'expense' });
  await createCategory({ name: 'Bills', kind: 'expense' });
  await createCategory({ name: 'Salary', kind: 'income', sortOrder: 0 });
  await createCategory({ name: 'Archived one', kind: 'expense' });
});

describe('category order', () => {
  it('lists categories A to Z, ignoring case', async () => {
    const names = (await listCategories()).map((c) => c.name);
    expect(names).toEqual(['Archived one', 'Bills', 'Food & Dining', 'Salary', 'Travel', 'zomato']);
  });

  it('keeps subcategories in the same A to Z order under their parent', async () => {
    const food = (await listCategories()).find((c) => c.name === 'Food & Dining')!;
    await createCategory({ name: 'Swiggy', kind: 'expense', parentId: food.id });
    await createCategory({ name: 'Bistro', kind: 'expense', parentId: food.id });
    await createCategory({ name: 'office cafeteria', kind: 'expense', parentId: food.id });
    const children = (await listCategories()).filter((c) => c.parentId === food.id).map((c) => c.name);
    expect(children).toEqual(['Bistro', 'office cafeteria', 'Swiggy']);
  });

  it('keeps the same order when archived categories are included', async () => {
    const archived = (await listCategories()).find((c) => c.name === 'Archived one')!;
    await archiveCategory(archived.id);
    expect((await listCategories()).map((c) => c.name)).not.toContain('Archived one');
    const all = (await listCategories(true)).map((c) => c.name);
    expect(all.indexOf('Archived one')).toBe(0);
  });

  it('orders budgets by category name the same way', async () => {
    const cats = await listCategories();
    const id = (name: string) => cats.find((c) => c.name === name)!.id;
    for (const name of ['zomato', 'Travel', 'Bills']) {
      await createBudget({ categoryId: id(name), limitAmountMinor: 100000, rollover: false });
    }
    expect((await listBudgetsForMonth()).map((b) => b.categoryName)).toEqual(['Bills', 'Travel', 'zomato']);
  });
});
