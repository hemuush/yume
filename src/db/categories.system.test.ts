/**
 * The five built-in categories the app matches by name (Loan EMI, Loan
 * Repayment, Fees & Charges, Friends & Family income + expense) are flagged
 * `is_system` and blocked from delete / archive / rename so that match can't
 * silently break. Everything else about them stays editable, and a user's
 * own category — even one named identically — is never treated as system.
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
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { listCategories, createCategory, updateCategory, archiveCategory, deleteCategory } from '@/db/ledger';

const SYSTEM = [
  { name: 'Loan Repayment', kind: 'income' },
  { name: 'Friends & Family', kind: 'income' },
  { name: 'Loan EMI', kind: 'expense' },
  { name: 'Fees & Charges', kind: 'expense' },
  { name: 'Friends & Family', kind: 'expense' },
] as const;

describe('DEFAULT_CATEGORIES seed data', () => {
  it('flags exactly the five system categories, by name and kind', () => {
    const flagged = DEFAULT_CATEGORIES.filter((c) => c.system)
      .map((c) => `${c.name}/${c.kind}`)
      .sort();
    expect(flagged).toEqual(SYSTEM.map((s) => `${s.name}/${s.kind}`).sort());
  });
});

describe('is_system enforcement', () => {
  let loanEmiId: string;
  let normalId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    // Seed the real default categories the way the app does.
    for (const c of DEFAULT_CATEGORIES) {
      await mockTestDb.runAsync(
        `INSERT INTO categories (id, name, kind, parent_id, icon, color, sort_order, is_sensitive, is_system)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
        [
          `seed-${c.name}-${c.kind}`,
          c.name,
          c.kind,
          c.icon,
          c.color,
          c.sortOrder,
          c.sensitive ? 1 : 0,
          c.system ? 1 : 0,
        ]
      );
    }
    loanEmiId = 'seed-Loan EMI-expense';
    normalId = 'seed-Groceries-expense';
  });

  it('rowToCategory surfaces isSystem for exactly the five', async () => {
    const cats = await listCategories();
    const systemNames = cats
      .filter((c) => c.isSystem)
      .map((c) => `${c.name}/${c.kind}`)
      .sort();
    expect(systemNames).toEqual(SYSTEM.map((s) => `${s.name}/${s.kind}`).sort());
  });

  it('blocks deleting a system category', async () => {
    await expect(deleteCategory(loanEmiId)).rejects.toThrow(/built-in category/i);
  });

  it('blocks archiving a system category', async () => {
    await expect(archiveCategory(loanEmiId)).rejects.toThrow(/built-in category/i);
    const cats = await listCategories(true);
    expect(cats.find((c) => c.id === loanEmiId)?.archived).toBe(false);
  });

  it('blocks renaming a system category but allows icon/colour/sensitivity edits', async () => {
    await expect(
      updateCategory(loanEmiId, { name: 'My EMIs', icon: 'credit-card', color: '#78350F' })
    ).rejects.toThrow(/name of a built-in category/i);

    await updateCategory(loanEmiId, {
      name: 'Loan EMI', // unchanged name is fine
      icon: 'bank',
      color: '#111111',
      isSensitive: true,
    });
    const cat = (await listCategories()).find((c) => c.id === loanEmiId)!;
    expect(cat.icon).toBe('bank');
    expect(cat.color).toBe('#111111');
    expect(cat.isSensitive).toBe(true);
    expect(cat.name).toBe('Loan EMI');
  });

  it('lets a system category gain a subcategory', async () => {
    const child = await createCategory({ name: 'Car loan', kind: 'expense', parentId: loanEmiId });
    expect(child.parentId).toBe(loanEmiId);
    expect(child.isSystem).toBe(false);
    await deleteCategory(child.id); // clean up (not system, no history)
  });

  it('a user-created category named like a built-in is NOT system and can be deleted', async () => {
    const impostor = await createCategory({ name: 'Loan EMI', kind: 'expense' });
    expect(impostor.isSystem).toBe(false);
    await expect(deleteCategory(impostor.id)).resolves.toBeUndefined();
  });

  it('still deletes and archives a normal built-in category', async () => {
    await expect(archiveCategory(normalId)).resolves.toBeUndefined();
  });
});

describe('migration backfill SQL flags the built-ins on an upgrading install', () => {
  it('sets is_system by name+kind for top-level rows only', async () => {
    const db = createRealDataTestDb();
    await db.execAsync(CREATE_TABLES_SQL);
    // Simulate a pre-is_system install: insert built-ins unflagged, plus a
    // user subcategory that happens to share a name.
    for (const c of DEFAULT_CATEGORIES) {
      await db.runAsync(
        `INSERT INTO categories (id, name, kind, parent_id, icon, color, sort_order, is_sensitive, is_system)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 0, 0)`,
        [`u-${c.name}-${c.kind}`, c.name, c.kind, c.icon, c.color, c.sortOrder]
      );
    }
    await db.runAsync(
      `INSERT INTO categories (id, name, kind, parent_id, icon, color, sort_order, is_sensitive, is_system)
       VALUES ('sub1', 'Loan EMI', 'expense', 'u-Food & Dining-expense', 'tag', '#000', 99, 0, 0)`
    );

    await db.runAsync(
      `UPDATE categories SET is_system = 1 WHERE is_system = 0 AND parent_id IS NULL AND (
         (name = 'Loan EMI' AND kind = 'expense') OR
         (name = 'Loan Repayment' AND kind = 'income') OR
         (name = 'Fees & Charges' AND kind = 'expense') OR
         (name = 'Friends & Family')
       )`
    );

    const flagged = await db.getAllAsync<{ name: string; kind: string }>(
      `SELECT name, kind FROM categories WHERE is_system = 1 ORDER BY kind, name`
    );
    expect(flagged.map((r) => `${r.name}/${r.kind}`).sort()).toEqual(
      SYSTEM.map((s) => `${s.name}/${s.kind}`).sort()
    );
    const sub = await db.getFirstAsync<{ is_system: number }>(
      `SELECT is_system FROM categories WHERE id = 'sub1'`
    );
    expect(sub!.is_system).toBe(0); // subcategory left alone
  });
});
