import { found } from './found';
import { CategoryRow } from './rows';
import { getDb } from './client';
import { newId } from '@/lib/id';
import { captureRows, restoreRows, RowSnapshot } from './undoSnapshot';
import { Category } from '@/types';
import { refreshPrivacyNotificationsAfterCommit } from './afterCommit';
import { CATEGORY_SELECT, rowToCategory, listCategories } from './categoryList';

export { listCategories };

/** Used by mutations that return a category/snapshot rather than the refresh status. Saves stay successful. */
async function refreshCategoryPrivacy(onReminderRefreshFailed?: () => void): Promise<void> {
  if ((await refreshPrivacyNotificationsAfterCommit()) === false) onReminderRefreshFailed?.();
}

/** Categories and subcategories: list, create, edit, archive and delete (re-exported from ./ledger). */

/**
 * Most-used expense categories since `sinceIso` for Quick Add shortcuts; excludes archived and system-filed
 * ones (Loan EMI, fees). Ties and sparse installs fall back to A to Z so the list stays full.
 */
export async function listMostUsedExpenseCategories(limit: number, sinceIso: string): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT c.*, COALESCE(p.is_sensitive, 0) AS parent_is_sensitive FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id
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

/**
 * Two active categories of the same kind with the same name side by side (same parent, or both top-level)
 * would be indistinguishable in every picker and report. Case-insensitive; archived ones don't count.
 */
async function assertUniqueCategoryName(
  db: Awaited<ReturnType<typeof getDb>>,
  name: string,
  kind: Category['kind'],
  parentId: string | null,
  exceptId?: string,
  restoring = false
): Promise<void> {
  const clash = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM categories
     WHERE kind = ? AND archived = 0 AND lower(name) = lower(?) AND COALESCE(parent_id, '') = COALESCE(?, '')
       AND id != COALESCE(?, '')
     LIMIT 1`,
    [kind, name, parentId, exceptId ?? null]
  );
  if (clash)
    throw new Error(
      restoring
        ? `There's already an active category called "${name}" here. Rename that category before restoring this one.`
        : `There's already a category called "${name}" here.`
    );
}

/** Validate the resulting active set inside the transaction, including a reactivated parent or Undo family. */
async function assertReactivatedNames(db: Awaited<ReturnType<typeof getDb>>, ids: string[]): Promise<void> {
  for (const id of ids) {
    const row = await db.getFirstAsync<CategoryRow>(
      'SELECT * FROM categories WHERE id = ? AND archived = 0',
      [id]
    );
    if (!row) continue;
    await assertUniqueCategoryName(db, row.name, row.kind, row.parent_id, row.id, true);
  }
}

export async function createCategory(
  input: {
    name: string;
    kind: Category['kind'];
    parentId?: string | null;
    icon?: string;
    color?: string;
    sortOrder?: number;
    isSensitive?: boolean;
  },
  onReminderRefreshFailed?: () => void
): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Give the category a name');
  const db = await getDb();
  let created: Category | null = null;
  await db.withTransactionAsync(async (tx) => {
    if (input.parentId) {
      await assertValidParent(tx, input.parentId, input.kind);
    }
    await assertUniqueCategoryName(tx, name, input.kind, input.parentId ?? null);
    const id = newId();
    await tx.runAsync(
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
    const row = await tx.getFirstAsync<CategoryRow & { parent_is_sensitive: number }>(
      `${CATEGORY_SELECT} WHERE c.id = ?`,
      [id]
    );
    created = rowToCategory(found(row, 'category'));
  });
  // A new sensitive child hides existing sibling/parent reminders as part of the same family.
  if (input.isSensitive && input.parentId) await refreshCategoryPrivacy(onReminderRefreshFailed);
  return found<Category>(created, 'category');
}

/**
 * Archiving a parent cascades to its subcategories, else an active child would be orphaned: its parent gone
 * from every picker and nobody able to find it again on purpose.
 */
export async function archiveCategory(id: string, onReminderRefreshFailed?: () => void): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await assertNotSystemCategory(tx, id, 'archived');
    await tx.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', [id]);
    await tx.runAsync('UPDATE categories SET archived = 1 WHERE parent_id = ?', [id]);
  });
  await refreshCategoryPrivacy(onReminderRefreshFailed);
}

/**
 * The five seeded `is_system` categories are matched by name to auto-file loan and Friends & Family entries;
 * deleting, archiving, renaming or reparenting one breaks that. Family actions also protect legacy children.
 */
async function assertNotSystemCategory(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  action: 'deleted' | 'archived'
): Promise<void> {
  const row = await db.getFirstAsync<{ name: string; is_system: number }>(
    'SELECT name, is_system FROM categories WHERE (id = ? OR parent_id = ?) AND is_system = 1 LIMIT 1',
    [id, id]
  );
  if (row?.is_system) {
    throw new Error(
      `"${row.name}" is a built-in category Yume uses to auto-categorise EMI, fees and Friends & Family entries — it can't be ${action}.`
    );
  }
}

/**
 * Brings a category back. A subcategory brings its parent back with it: an active child under an archived
 * parent would sit in no picker (pickers open a parent to reach its children).
 */
export async function unarchiveCategory(id: string, onReminderRefreshFailed?: () => void): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE categories SET archived = 0 WHERE id = ?', [id]);
    await tx.runAsync(
      `UPDATE categories SET archived = 0
       WHERE id = (SELECT parent_id FROM categories WHERE id = ?) AND archived = 1`,
      [id]
    );
    const row = await tx.getFirstAsync<{ parent_id: string | null }>(
      'SELECT parent_id FROM categories WHERE id = ?',
      [id]
    );
    await assertReactivatedNames(tx, [id, ...(row?.parent_id ? [row.parent_id] : [])]);
  });
  await refreshCategoryPrivacy(onReminderRefreshFailed);
}

/** Returns false when the edit committed but private reminder content could not be refreshed. */
export async function updateCategory(
  id: string,
  input: { name: string; icon: string; color: string; parentId?: string | null; isSensitive?: boolean }
): Promise<boolean> {
  const name = input.name.trim();
  if (!name) throw new Error('Give the category a name');
  const db = await getDb();
  let affectsPrivacy = false;
  await db.withTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
    if (!current) throw new Error('Category not found');
    // A built-in category is matched by name at runtime — its icon, colour,
    // sensitivity and subcategories stay editable, but its name and parent are fixed.
    if (current.is_system && name !== current.name) {
      throw new Error("The name of a built-in category can't be changed.");
    }
    // Omitted `parentId` means "leave as-is": defaulting to null would strip the parent on every plain
    // edit by callers that never pass it. Same for `isSensitive`.
    const nextParentId = input.parentId !== undefined ? input.parentId : current.parent_id;
    if (current.is_system && nextParentId !== current.parent_id) {
      throw new Error("The parent of a built-in category can't be changed.");
    }
    const nextIsSensitive = input.isSensitive !== undefined ? input.isSensitive : !!current.is_sensitive;
    affectsPrivacy = nextParentId !== current.parent_id || nextIsSensitive !== !!current.is_sensitive;
    if (nextParentId) {
      const hasChildren = await tx.getFirstAsync<{ id: string }>(
        'SELECT id FROM categories WHERE parent_id = ? LIMIT 1',
        [id]
      );
      if (hasChildren) {
        throw new Error(
          "This category already has subcategories of its own — it can't also become a subcategory."
        );
      }
      await assertValidParent(tx, nextParentId, current.kind, id);
    }
    await assertUniqueCategoryName(tx, name, current.kind, nextParentId, id);
    await tx.runAsync(
      'UPDATE categories SET name = ?, icon = ?, color = ?, parent_id = ?, is_sensitive = ? WHERE id = ?',
      [name, input.icon, input.color, nextParentId, nextIsSensitive ? 1 : 0, id]
    );
  });
  return !affectsPrivacy || refreshPrivacyNotificationsAfterCommit();
}

/**
 * Deletes an unused category (else archive); blocked if a transaction or recurring rule uses it or its subs.
 * Why: transactions' CHECK gives a raw SQL error; a rule left with null category_id throws on its next run.
 */
export async function deleteCategory(
  id: string,
  onReminderRefreshFailed?: () => void
): Promise<RowSnapshot[]> {
  const db = await getDb();
  let snapshots: RowSnapshot[] = [];
  // Usage checks, capture and delete share one transaction, so an entry saved in between can't hit the FK.
  await db.withTransactionAsync(async (tx) => {
    await assertNotSystemCategory(tx, id, 'deleted');
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
    // Budgets cascade with the category. Keep every month, after all categories for FK-safe Undo.
    snapshots.push(...(await captureRows(tx, 'budgets', `category_id IN (${placeholders})`, idsToCheck)));
    await tx.runAsync('DELETE FROM categories WHERE id = ? OR parent_id = ?', [id, id]);
  });
  if (snapshots.some((s) => s.table === 'categories' && s.row.is_sensitive === 1)) {
    await refreshCategoryPrivacy(onReminderRefreshFailed);
  }
  return snapshots;
}

/** Undoes `deleteCategory`: categories parent-first, then all their captured monthly budgets. */
export async function restoreCategory(
  snapshots: RowSnapshot[],
  onReminderRefreshFailed?: () => void
): Promise<void> {
  const db = await getDb();
  // All-or-nothing: a failure part-way can't leave a parent restored without its subcategories.
  await db.withTransactionAsync(async (tx) => {
    await restoreRows(tx, snapshots);
    await assertReactivatedNames(
      tx,
      snapshots.filter((s) => s.table === 'categories').map((s) => String(s.row.id))
    );
  });
  if (snapshots.some((s) => s.table === 'categories' && s.row.is_sensitive === 1)) {
    await refreshCategoryPrivacy(onReminderRefreshFailed);
  }
}
