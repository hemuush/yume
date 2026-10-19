import { createRealDataTestDb } from '@/test-support/realDataTestDb';
let mockDb = createRealDataTestDb();
jest.mock('./client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));
import { CREATE_TABLES_SQL } from './schema';
import {
  createCategory,
  archiveCategory,
  unarchiveCategory,
  listCategories,
  deleteCategory,
  restoreCategory,
  updateCategory,
} from './categories';
import { createBudget } from './budgets';
import { resetSettingsCache } from './settings';

beforeEach(async () => {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
});

it('rejects case-insensitive root collisions on restore and allows retry after renaming the active category', async () => {
  const old = await createCategory({ name: 'Travel', kind: 'expense' });
  await archiveCategory(old.id);
  const active = await createCategory({ name: 'travel', kind: 'expense' });
  await expect(unarchiveCategory(old.id)).rejects.toThrow('Rename that category');
  expect((await listCategories(true)).find((c) => c.id === old.id)?.archived).toBe(true);
  expect((await listCategories()).map((c) => c.id)).toEqual([active.id]);
  await updateCategory(active.id, { name: 'Other travel', icon: active.icon, color: active.color });
  await unarchiveCategory(old.id);
  expect(await listCategories()).toHaveLength(2);
});

it('rejects sibling collisions without reactivating the archived child', async () => {
  const parent = await createCategory({ name: 'Transport', kind: 'expense' });
  const old = await createCategory({ name: 'Taxi', kind: 'expense', parentId: parent.id });
  await archiveCategory(old.id);
  await createCategory({ name: 'Taxi', kind: 'expense', parentId: parent.id });
  await expect(unarchiveCategory(old.id)).rejects.toThrow('active category');
  expect((await listCategories(true)).find((c) => c.id === old.id)?.archived).toBe(true);
});

it('rolls the child and parent back when implicit parent reactivation would collide', async () => {
  const parent = await createCategory({ name: 'Bills', kind: 'expense' });
  const child = await createCategory({ name: 'Power', kind: 'expense', parentId: parent.id });
  await archiveCategory(parent.id);
  await createCategory({ name: 'Bills', kind: 'expense' });
  await expect(unarchiveCategory(child.id)).rejects.toThrow('Bills');
  const all = await listCategories(true);
  expect(all.find((c) => c.id === parent.id)?.archived).toBe(true);
  expect(all.find((c) => c.id === child.id)?.archived).toBe(true);
});

it('rolls Undo categories and monthly budgets back together on a name collision', async () => {
  const parent = await createCategory({ name: 'Family', kind: 'expense' });
  const child = await createCategory({ name: 'Child', kind: 'expense', parentId: parent.id });
  await createBudget({
    categoryId: child.id,
    limitAmountMinor: 10000,
    periodMonth: '2026-10',
    rollover: false,
  });
  const snapshots = await deleteCategory(parent.id);
  const active = await createCategory({ name: 'Family', kind: 'expense' });
  await expect(restoreCategory(snapshots)).rejects.toThrow('Rename that category');
  expect((await listCategories(true)).map((c) => c.id)).toEqual([active.id]);
  expect(await mockDb.getAllAsync('SELECT * FROM budgets')).toEqual([]);
  await updateCategory(active.id, { name: 'Other family', icon: active.icon, color: active.color });
  await restoreCategory(snapshots);
  expect((await listCategories()).map((c) => c.id)).toEqual(expect.arrayContaining([parent.id, child.id]));
  expect(await mockDb.getAllAsync('SELECT category_id FROM budgets')).toEqual([{ category_id: child.id }]);
});

it('allows identical names for different kinds or different parents', async () => {
  const old = await createCategory({ name: 'Gift', kind: 'expense' });
  await archiveCategory(old.id);
  await createCategory({ name: 'Gift', kind: 'income' });
  const parent = await createCategory({ name: 'Other', kind: 'expense' });
  await createCategory({ name: 'Gift', kind: 'expense', parentId: parent.id });
  await unarchiveCategory(old.id);
  expect((await listCategories()).filter((c) => c.name === 'Gift')).toHaveLength(3);
});
