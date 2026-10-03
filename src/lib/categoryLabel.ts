import { Category } from '@/types';

/**
 * How a subcategory is worded wherever it appears: two subcategories can share
 * a name under different parents ("Flipkart Minutes" under Food & Dining and
 * under Groceries), so every screen says which parent a subcategory is in.
 * A top-level category has no parent and is never prefixed.
 */

type CategoryLookup = ReadonlyMap<string, Pick<Category, 'name' | 'parentId'>>;

/** The parent's name for a category id, or undefined for a top-level (or unknown) category. */
export function parentNameOf(
  categoryId: string | null | undefined,
  byId: CategoryLookup
): string | undefined {
  const cat = categoryId ? byId.get(categoryId) : undefined;
  return cat?.parentId ? byId.get(cat.parentId)?.name : undefined;
}

/** "in Food & Dining": the line under a subcategory's name. Undefined for a top-level category. */
export function inParent(parentName: string | null | undefined): string | undefined {
  return parentName ? `in ${parentName}` : undefined;
}

/** "Food & Dining › Flipkart Minutes": a one-line label with no line under it (chips, toasts, sheet titles). */
export function categoryPath(name: string, parentName?: string | null): string {
  return parentName ? `${parentName} › ${name}` : name;
}

/** "Flipkart Minutes (Food & Dining)": a subcategory inside a sentence. */
export function categorySentence(name: string, parentName?: string | null): string {
  return parentName ? `${name} (${parentName})` : name;
}

/** "Flipkart Minutes, in Food & Dining": for screen readers. */
export function categorySpoken(name: string, parentName?: string | null): string {
  return parentName ? `${name}, in ${parentName}` : name;
}

/** Joins the parts of a second line with " · ", skipping any that are empty. */
export function joinSub(parts: readonly (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(' · ');
}
