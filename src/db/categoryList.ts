import { getDb } from './client';
import { CategoryRow } from './rows';
import { Category } from '@/types';

// Read side of categories, apart from categories.ts: the alert builder needs the list, while the writes need the
// notification scheduler that builds those alerts.
/**
 * Every category query reads through this: the row plus its parent's "hide with amounts" flag, which a
 * subcategory inherits.
 */
export const CATEGORY_SELECT = `SELECT c.*, COALESCE(p.is_sensitive, 0) AS parent_is_sensitive
  FROM categories c LEFT JOIN categories p ON p.id = c.parent_id`;

export function rowToCategory(row: CategoryRow & { parent_is_sensitive?: number }): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    parentId: row.parent_id,
    icon: row.icon,
    color: row.color,
    archived: !!row.archived,
    sortOrder: row.sort_order,
    isSensitive: !!row.is_sensitive || !!row.parent_is_sensitive,
    ownIsSensitive: !!row.is_sensitive,
    isSystem: !!row.is_system,
  };
}

/**
 * Every category A to Z by name, ignoring case: the order all pickers, filters and lists use.
 * Not `sort_order`: it's only the seed order, and new categories all get 0.
 */
export async function listCategories(includeArchived = false): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow & { parent_is_sensitive: number }>(
    `${CATEGORY_SELECT} ${includeArchived ? '' : 'WHERE c.archived = 0'} ORDER BY c.name COLLATE NOCASE ASC, c.id ASC`
  );
  return rows.map(rowToCategory);
}
