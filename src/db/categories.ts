import { found } from './found';
import { CategoryRow } from './rows';
import { getDb } from './client';
import { newId } from '@/lib/id';
import { captureRows, restoreRows, RowSnapshot } from './undoSnapshot';
import { Category } from '@/types';

/** Categories and subcategories: list, create, edit, archive and delete (re-exported from ./ledger). */

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    parentId: row.parent_id,
    icon: row.icon,
    color: row.color,
    archived: !!row.archived,
    sortOrder: row.sort_order,
    isSensitive: !!row.is_sensitive,
    isSystem: !!row.is_system,
  };
}

/**
 * Every category A to Z by name, ignoring case: the order all pickers, filters and lists use.
 * Not `sort_order`: it's only the seed order, and new categories all get 0.
 */
export async function listCategories(includeArchived = false): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT * FROM categories ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name COLLATE NOCASE ASC, id ASC`
  );
  return rows.map(rowToCategory);
}

/**
 * Most-used expense categories since `sinceIso` for Quick Add shortcuts; excludes archived and system-filed
 * ones (Loan EMI, fees). Ties and sparse installs fall back to A to Z so the list stays full.
 */
export async function listMostUsedExpenseCategories(limit: number, sinceIso: string): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT c.* FROM categories c
     LEFT JOIN (
       SELECT category_id, COUNT(*) AS uses FROM transactions
       WHERE type = 'expense' AND date >= ? AND category_id IS NOT NULL
       GROUP BY category_id
     ) u ON u.category_id = c.id
     WHERE c.kind = 'expense' AND c.archived = 0 AND c.is_system = 0
     ORDER BY COALESCE(u.uses, 0) DESC, c.parent_id IS NOT NULL, c.name COLLATE NOCASE ASC, c.id ASC
     LIMIT ?`,
    [sinceIso, limit]
  );
  return rows.map(rowToCategory);
}

/**
 * Only two levels: a subcategory can't have children. Pickers and the Reports rollup can't handle a third,
 * so it would silently misbehave rather than be visibly rejected.
 */
async function assertValidParent(
  db: Awaited<ReturnType<typeof getDb>>,
  parentId: string,
  kind: Category['kind'],
  selfId?: string
): Promise<void> {
  if (parentId === selfId) {
    throw new Error("A category can't be its own parent");
  }
  const parent = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [parentId]);
  if (!parent) throw new Error('Parent category not found');
  if (parent.parent_id) {
    throw new Error(
      'Subcategories can only be one level deep — pick a top-level category as the parent instead.'
    );
  }
  if (parent.kind !== kind) {
    throw new Error('A subcategory must be the same kind (income/expense) as its parent');
  }
}

export async function createCategory(input: {
  name: string;
  kind: Category['kind'];
  parentId?: string | null;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isSensitive?: boolean;
}): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Give the category a name');
  const db = await getDb();
  if (input.parentId) {
    await assertValidParent(db, input.parentId, input.kind);
  }
  const id = newId();
  await db.runAsync(
    `INSERT INTO categories (id, name, kind, parent_id, icon, color, sort_order, is_sensitive)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      input.kind,
      input.parentId ?? null,
      input.icon ?? 'tag',
      input.color ?? '#6366F1',
      input.sortOrder ?? 0,
      input.isSensitive ? 1 : 0,
    ]
  );
  const row = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
  return rowToCategory(found(row, 'category'));
}

/**
 * Archiving a parent cascades to its subcategories, else an active child would be orphaned: its parent gone
 * from every picker and nobody able to find it again on purpose.
 */
export async function archiveCategory(id: string): Promise<void> {
  const db = await getDb();
  await assertNotSystemCategory(db, id, 'archived');
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', [id]);
    await tx.runAsync('UPDATE categories SET archived = 1 WHERE parent_id = ?', [id]);
  });
}

/**
 * The five seeded `is_system` categories are matched by name to auto-file loan and Friends & Family entries;
 * deleting, archiving or renaming one breaks that, so all three are blocked here (every UI path funnels in).
 */
async function assertNotSystemCategory(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  action: 'deleted' | 'archived'
): Promise<void> {
  const row = await db.getFirstAsync<{ name: string; is_system: number }>(
    'SELECT name, is_system FROM categories WHERE id = ?',
    [id]
  );
  if (row?.is_system) {
    throw new Error(
      `"${row.name}" is a built-in category Yume uses to auto-categorise EMI, fees and Friends & Family entries — it can't be ${action}.`
    );
  }
}

export async function unarchiveCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET archived = 0 WHERE id = ?', [id]);
}

export async function updateCategory(
  id: string,
  input: { name: string; icon: string; color: string; parentId?: string | null; isSensitive?: boolean }
): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Give the category a name');
  const db = await getDb();
  const current = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
  if (!current) throw new Error('Category not found');
  // A built-in category is matched by name at runtime — its icon, colour,
  // sensitivity and subcategories stay editable, but the name is fixed.
  if (current.is_system && name !== current.name) {
    throw new Error("The name of a built-in category can't be changed.");
  }
  // Omitted `parentId` means "leave as-is": defaulting to null would strip the parent on every plain
  // edit by callers that never pass it. Same for `isSensitive`.
  const nextParentId = input.parentId !== undefined ? input.parentId : current.parent_id;
  const nextIsSensitive = input.isSensitive !== undefined ? input.isSensitive : !!current.is_sensitive;
  if (nextParentId) {
    const hasChildren = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM categories WHERE parent_id = ? LIMIT 1',
      [id]
    );
    if (hasChildren) {
      throw new Error(
        "This category already has subcategories of its own — it can't also become a subcategory."
      );
    }
    await assertValidParent(db, nextParentId, current.kind, id);
  }
  await db.runAsync(
    'UPDATE categories SET name = ?, icon = ?, color = ?, parent_id = ?, is_sensitive = ? WHERE id = ?',
    [name, input.icon, input.color, nextParentId, nextIsSensitive ? 1 : 0, id]
  );
}

/**
 * Deletes an unused category (else archive); blocked if a transaction or recurring rule uses it or its subs.
 * Why: transactions' CHECK gives a raw SQL error; a rule left with null category_id throws on its next run.
 */
export async function deleteCategory(id: string): Promise<RowSnapshot[]> {
  const db = await getDb();
  await assertNotSystemCategory(db, id, 'deleted');
  let snapshots: RowSnapshot[] = [];
  // Usage checks, capture and delete share one transaction, so an entry saved in between can't hit the FK.
  await db.withTransactionAsync(async (tx) => {
    const children = await tx.getAllAsync<{ id: string }>('SELECT id FROM categories WHERE parent_id = ?', [
      id,
    ]);
    const idsToCheck = [id, ...children.map((c) => c.id)];
    const placeholders = idsToCheck.map(() => '?').join(', ');

    const txCount = await tx.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE category_id IN (${placeholders})`,
      idsToCheck
    );
    if ((txCount?.count ?? 0) > 0) {
      const n = txCount!.count;
      throw new Error(
        `This category has ${n} transaction${n === 1 ? '' : 's'} against it${children.length ? ' (including its subcategories)' : ''} — archive it instead, so its history stays intact.`
      );
    }

    const ruleCount = await tx.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM recurring_rules WHERE category_id IN (${placeholders})`,
      idsToCheck
    );
    if ((ruleCount?.count ?? 0) > 0) {
      const n = ruleCount!.count;
      throw new Error(
        `This category is used by ${n} recurring rule${n === 1 ? '' : 's'} — remove or reassign ${n === 1 ? 'it' : 'them'} first, so automatic entries don't break.`
      );
    }

    // Sorted parent-first: `restoreCategory` re-inserts in this same order, and
    // a child row's `parent_id` foreign key needs its parent to already exist.
    snapshots = (await captureRows(tx, 'categories', 'id = ? OR parent_id = ?', [id, id])).sort((x, y) =>
      x.row.id === id ? -1 : y.row.id === id ? 1 : 0
    );
    await tx.runAsync('DELETE FROM categories WHERE id = ? OR parent_id = ?', [id, id]);
  });
  return snapshots;
}

/** Undoes `deleteCategory` — re-inserts the category (and any subcategories it took with it), in the same parent-first order they were captured. */
export async function restoreCategory(snapshots: RowSnapshot[]): Promise<void> {
  const db = await getDb();
  // All-or-nothing: a failure part-way can't leave a parent restored without its subcategories.
  await db.withTransactionAsync(async (tx) => {
    await restoreRows(tx, snapshots);
  });
}
