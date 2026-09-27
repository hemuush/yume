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
 * Every category, A to Z by name, ignoring case — the order every picker,
 * filter and list shows them in (subcategories too, since each screen picks
 * a parent's children out of this same list). `sort_order` is only the
 * built-in defaults' seed order, and every category you add gets 0, so
 * ordering by it put new categories in no useful place.
 */
export async function listCategories(includeArchived = false): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT * FROM categories ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name COLLATE NOCASE ASC, id ASC`
  );
  return rows.map(rowToCategory);
}

/**
 * Only two levels are allowed — a subcategory can't itself have children.
 * Without this, "Food & Dining > Zomato > Lunch orders" would be possible to
 * create but nothing in the app (pickers, the Reports rollup) knows how to
 * render or aggregate a third level, so it would just silently misbehave
 * rather than being visibly rejected here.
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
      input.name,
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
 * Archiving a parent cascades to its subcategories — leaving "Zomato" active
 * while its parent "Food & Dining" disappears from every picker would leave
 * an orphaned subcategory nobody can find or pick again on purpose.
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
 * The five seeded categories flagged `is_system` (Loan EMI, Loan Repayment,
 * Fees & Charges, Friends & Family income + expense) are looked up by name
 * at runtime to auto-file loan and Friends & Family transactions — deleting,
 * archiving, or renaming one silently breaks that match, so all three are
 * blocked here where every UI path funnels through.
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
  const db = await getDb();
  const current = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
  if (!current) throw new Error('Category not found');
  // A built-in category is matched by name at runtime — its icon, colour,
  // sensitivity and subcategories stay editable, but the name is fixed.
  if (current.is_system && input.name.trim() !== current.name) {
    throw new Error("The name of a built-in category can't be changed.");
  }
  // `parentId` omitted entirely means "leave it as-is" — every existing call
  // site predates re-parenting support and never passes it, so defaulting a
  // missing field to null here would silently strip the parent off every
  // plain name/icon/color edit. Same pattern for `isSensitive`.
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
    [input.name, input.icon, input.color, nextParentId, nextIsSensitive ? 1 : 0, id]
  );
}

/**
 * Permanently removes a category — for one added by mistake or never used,
 * not for one with real history (archive that instead, same split as
 * `deleteAccount`/`deleteLoan`). Blocked whenever any transaction or
 * recurring rule — this category's own, or any of its subcategories' —
 * still references it:
 *   - `transactions.category_id` is `ON DELETE SET NULL`, but the table also
 *     has `CHECK (type = 'transfer' OR category_id IS NOT NULL)`, so a raw
 *     delete of an in-use category would fail with a bare SQL constraint
 *     error instead of a clear message — checked and blocked here first.
 *   - `recurring_rules.category_id` is also `ON DELETE SET NULL` with no
 *     such CHECK, so a raw delete would silently succeed at the DB level —
 *     but the next `runDueRecurringRules()` pass would then call
 *     `createTransaction` with a null categoryId for that rule and throw,
 *     uncaught, aborting that automatic run. Blocking here instead means
 *     the user reassigns/removes the rule first, on their own terms.
 * Once past both checks, deleting cascades to subcategories (verified
 * unused above) and any budgets (schema's own `ON DELETE CASCADE` —
 * harmless today since nothing creates budgets yet).
 */
export async function deleteCategory(id: string): Promise<RowSnapshot[]> {
  const db = await getDb();
  await assertNotSystemCategory(db, id, 'deleted');
  const children = await db.getAllAsync<{ id: string }>('SELECT id FROM categories WHERE parent_id = ?', [
    id,
  ]);
  const idsToCheck = [id, ...children.map((c) => c.id)];
  const placeholders = idsToCheck.map(() => '?').join(', ');

  const txCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE category_id IN (${placeholders})`,
    idsToCheck
  );
  if ((txCount?.count ?? 0) > 0) {
    const n = txCount!.count;
    throw new Error(
      `This category has ${n} transaction${n === 1 ? '' : 's'} against it${children.length ? ' (including its subcategories)' : ''} — archive it instead, so its history stays intact.`
    );
  }

  const ruleCount = await db.getFirstAsync<{ count: number }>(
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
  const snapshots = (await captureRows(db, 'categories', 'id = ? OR parent_id = ?', [id, id])).sort((a, b) =>
    a.row.id === id ? -1 : b.row.id === id ? 1 : 0
  );
  await db.runAsync('DELETE FROM categories WHERE id = ? OR parent_id = ?', [id, id]);
  return snapshots;
}

/** Undoes `deleteCategory` — re-inserts the category (and any subcategories it took with it), in the same parent-first order they were captured. */
export async function restoreCategory(snapshots: RowSnapshot[]): Promise<void> {
  const db = await getDb();
  await restoreRows(db, snapshots);
}
