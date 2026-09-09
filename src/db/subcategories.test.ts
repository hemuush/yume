/**
 * Subcategory support (categories.parent_id) against a real SQLite engine:
 * creation/re-parenting validation in db/ledger.ts, cascade-archive, and the
 * Reports rollup (a subcategory's spend folds into its parent's row, with a
 * drill-down available via getSubcategoryBreakdown).
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
import {
  createAccount,
  createCategory,
  updateCategory,
  archiveCategory,
  deleteCategory,
  listCategories,
  createTransaction,
} from '@/db/ledger';
import { getPeriodSummary, getSubcategoryBreakdown } from '@/db/reports';
import { createRecurringRule } from '@/db/recurring';

describe('subcategories', () => {
  let accountId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
  });

  it('creates a subcategory under a valid parent, and rejects invalid parenting', async () => {
    const food = await createCategory({ name: 'Food & Dining', kind: 'expense' });
    const zomato = await createCategory({ name: 'Zomato', kind: 'expense', parentId: food.id });
    expect(zomato.parentId).toBe(food.id);

    // Different kind than parent.
    await expect(createCategory({ name: 'Bad', kind: 'income', parentId: food.id })).rejects.toThrow(
      'same kind'
    );

    // A subcategory can't itself be a parent (only one level deep).
    await expect(
      createCategory({ name: 'Grandchild', kind: 'expense', parentId: zomato.id })
    ).rejects.toThrow('one level deep');

    // Nonexistent parent.
    await expect(
      createCategory({ name: 'Orphan', kind: 'expense', parentId: 'not-a-real-id' })
    ).rejects.toThrow('Parent category not found');
  });

  it('updateCategory can re-parent a leaf category, but refuses once it has children, and preserves parentId when omitted', async () => {
    const travel = await createCategory({ name: 'Travel', kind: 'expense' });
    const transport = await createCategory({ name: 'Transport', kind: 'expense' });
    const uber = await createCategory({ name: 'Uber', kind: 'expense', parentId: transport.id });

    // Re-parent Uber from Transport to Travel.
    await updateCategory(uber.id, {
      name: uber.name,
      icon: uber.icon,
      color: uber.color,
      parentId: travel.id,
    });
    let fresh = (await listCategories()).find((c) => c.id === uber.id)!;
    expect(fresh.parentId).toBe(travel.id);

    // A plain edit that omits parentId must not clear it.
    await updateCategory(uber.id, { name: 'Uber Rides', icon: uber.icon, color: uber.color });
    fresh = (await listCategories()).find((c) => c.id === uber.id)!;
    expect(fresh.name).toBe('Uber Rides');
    expect(fresh.parentId).toBe(travel.id);

    // Travel now has a child (Uber Rides) — it can't also become a subcategory.
    await expect(
      updateCategory(travel.id, {
        name: travel.name,
        icon: travel.icon,
        color: travel.color,
        parentId: transport.id,
      })
    ).rejects.toThrow('already has subcategories');
  });

  it('archiveCategory cascades to its subcategories', async () => {
    const shopping = await createCategory({ name: 'Shopping', kind: 'expense' });
    const amazon = await createCategory({ name: 'Amazon', kind: 'expense', parentId: shopping.id });
    const flipkart = await createCategory({ name: 'Flipkart', kind: 'expense', parentId: shopping.id });

    await archiveCategory(shopping.id);
    const all = await listCategories(true);
    expect(all.find((c) => c.id === shopping.id)?.archived).toBe(true);
    expect(all.find((c) => c.id === amazon.id)?.archived).toBe(true);
    expect(all.find((c) => c.id === flipkart.id)?.archived).toBe(true);
  });

  it('getPeriodSummary rolls subcategory spend up into the parent row, and flags hasSubcategories', async () => {
    const entertainment = await createCategory({ name: 'Entertainment Test', kind: 'expense' });
    const netflix = await createCategory({
      name: 'Netflix Test',
      kind: 'expense',
      parentId: entertainment.id,
    });
    const spotify = await createCategory({
      name: 'Spotify Test',
      kind: 'expense',
      parentId: entertainment.id,
    });

    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: netflix.id,
      amountMinor: 50000,
      date: '2031-01-05',
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: spotify.id,
      amountMinor: 20000,
      date: '2031-01-06',
    });
    // Direct spend against the parent itself (no specific subcategory picked).
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: entertainment.id,
      amountMinor: 10000,
      date: '2031-01-07',
    });

    const summary = await getPeriodSummary({ start: '2031-01-01', end: '2031-01-31' });
    const row = summary.categoryBreakdown.find((c) => c.categoryId === entertainment.id);
    expect(row).toBeDefined();
    expect(row!.totalMinor).toBe(80000); // 50000 + 20000 + 10000, all rolled up
    expect(row!.hasSubcategories).toBe(true);
    // Netflix/Spotify must NOT appear as their own independent rows.
    expect(summary.categoryBreakdown.some((c) => c.categoryId === netflix.id)).toBe(false);
    expect(summary.categoryBreakdown.some((c) => c.categoryId === spotify.id)).toBe(false);

    const drill = await getSubcategoryBreakdown(entertainment.id, { start: '2031-01-01', end: '2031-01-31' });
    const byName = new Map(drill.map((d) => [d.name, d.totalMinor]));
    expect(byName.get('Netflix Test')).toBe(50000);
    expect(byName.get('Spotify Test')).toBe(20000);
    expect(byName.get('Other Entertainment Test')).toBe(10000);
  });

  it('createCategory/updateCategory persist isSensitive, and getPeriodSummary rolls it up as true if the parent OR any subcategory is flagged', async () => {
    const plainParent = await createCategory({ name: 'Plain Sensitivity Test', kind: 'expense' });
    expect(plainParent.isSensitive).toBe(false);

    const flaggedAtCreate = await createCategory({
      name: 'Investments Test',
      kind: 'expense',
      isSensitive: true,
    });
    expect(flaggedAtCreate.isSensitive).toBe(true);

    await updateCategory(plainParent.id, {
      name: plainParent.name,
      icon: plainParent.icon,
      color: plainParent.color,
      isSensitive: true,
    });
    let fresh = (await listCategories()).find((c) => c.id === plainParent.id)!;
    expect(fresh.isSensitive).toBe(true);

    // Omitting isSensitive on a plain edit must not silently clear it — same
    // "omitted means leave as-is" contract parentId already has.
    await updateCategory(plainParent.id, {
      name: 'Plain Sensitivity Test (renamed)',
      icon: plainParent.icon,
      color: plainParent.color,
    });
    fresh = (await listCategories()).find((c) => c.id === plainParent.id)!;
    expect(fresh.name).toBe('Plain Sensitivity Test (renamed)');
    expect(fresh.isSensitive).toBe(true);

    // Rollup: a parent that is itself unflagged, but has a flagged
    // subcategory, must still report isSensitive=true — otherwise the
    // subcategory's amount would leak through the parent's unmasked total.
    const parent = await createCategory({ name: 'SensitivityRollup Parent', kind: 'expense' });
    const sensitiveChild = await createCategory({
      name: 'SensitivityRollup Child',
      kind: 'expense',
      parentId: parent.id,
      isSensitive: true,
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: sensitiveChild.id,
      amountMinor: 5000,
      date: '2031-02-10',
    });
    const summary = await getPeriodSummary({ start: '2031-02-01', end: '2031-02-28' });
    const parentRow = summary.categoryBreakdown.find((c) => c.categoryId === parent.id);
    expect(parentRow?.isSensitive).toBe(true);

    const drill = await getSubcategoryBreakdown(parent.id, { start: '2031-02-01', end: '2031-02-28' });
    expect(drill.find((d) => d.name === 'SensitivityRollup Child')?.isSensitive).toBe(true);
  });

  it('deleteCategory removes an unused category, but blocks one with real transaction history', async () => {
    const unused = await createCategory({ name: 'Unused Test', kind: 'expense' });
    await deleteCategory(unused.id);
    expect((await listCategories(true)).some((c) => c.id === unused.id)).toBe(false);

    const used = await createCategory({ name: 'Used Test', kind: 'expense' });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: used.id,
      amountMinor: 500,
      date: '2031-02-01',
    });
    await expect(deleteCategory(used.id)).rejects.toThrow('archive it instead');
    expect((await listCategories(true)).some((c) => c.id === used.id)).toBe(true);
  });

  it('deleteCategory is blocked when a subcategory (not the parent itself) has a transaction', async () => {
    const parent = await createCategory({ name: 'Parent Test', kind: 'expense' });
    const child = await createCategory({ name: 'Child Test', kind: 'expense', parentId: parent.id });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: child.id,
      amountMinor: 700,
      date: '2031-02-02',
    });

    await expect(deleteCategory(parent.id)).rejects.toThrow('including its subcategories');
    expect((await listCategories(true)).some((c) => c.id === parent.id)).toBe(true);
    expect((await listCategories(true)).some((c) => c.id === child.id)).toBe(true);
  });

  it('deleteCategory cascades to subcategories when the whole group is genuinely unused', async () => {
    const parent = await createCategory({ name: 'CascadeDelete Test', kind: 'expense' });
    const child1 = await createCategory({
      name: 'CascadeDelete Child 1',
      kind: 'expense',
      parentId: parent.id,
    });
    const child2 = await createCategory({
      name: 'CascadeDelete Child 2',
      kind: 'expense',
      parentId: parent.id,
    });

    await deleteCategory(parent.id);
    const all = await listCategories(true);
    expect(all.some((c) => c.id === parent.id)).toBe(false);
    expect(all.some((c) => c.id === child1.id)).toBe(false);
    expect(all.some((c) => c.id === child2.id)).toBe(false);
  });

  it('deleteCategory is blocked when a recurring rule references it, so automatic entries never silently break', async () => {
    const rulesCat = await createCategory({ name: 'RecurringBlock Test', kind: 'expense' });
    await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: rulesCat.id,
      amountMinor: 1000,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2031-03-01',
    });

    await expect(deleteCategory(rulesCat.id)).rejects.toThrow('recurring rule');
    expect((await listCategories(true)).some((c) => c.id === rulesCat.id)).toBe(true);
  });
});
