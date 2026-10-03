import { Category } from '@/types';

/**
 * Orders a flat category list so each subcategory sits right after its parent (used by every category
 * picker), instead of wherever sort_order scatters it.
 */
export function orderCategoriesForPicker(categories: Category[]): Category[] {
  const topLevel = categories.filter((c) => !c.parentId);
  const out: Category[] = [];
  for (const parent of topLevel) {
    out.push(parent);
    out.push(...categories.filter((c) => c.parentId === parent.id));
  }
  return out;
}

/** Just the top-level categories — the collapsed-by-default view every picker shows before a parent is expanded. */
export function topLevelOnly(categories: Category[]): Category[] {
  return categories.filter((c) => !c.parentId);
}

/** A parent's own subcategories, in their existing order. */
export function childrenOf(categories: Category[], parentId: string): Category[] {
  return categories.filter((c) => c.parentId === parentId);
}

/**
 * Categories whose name matches `query` (case-insensitive), prefix matches first; lets Add's "Find a
 * category" reach a subcategory without opening its parent. Empty for a blank query.
 */
export function searchCategories(categories: Category[], query: string): Category[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: Category[] = [];
  const contains: Category[] = [];
  for (const c of categories) {
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) starts.push(c);
    else if (name.includes(q)) contains.push(c);
  }
  return [...starts, ...contains];
}
