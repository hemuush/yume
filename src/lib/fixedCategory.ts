/**
 * Which categories are a fixed monthly load rather than a choice: an EMI, rent, insurance, a subscription.
 * Reports counts them as "already spoken for", and Plan does not suggest cutting them ("spend 10% less on rent"
 * is not a choice you make in a budget). One list, so the two agree.
 */
const FIXED_CATEGORY_NAMES: readonly string[] = ['Loan EMI', 'Rent', 'Insurance', 'Subscriptions'];

export function isFixedCategoryName(name: string): boolean {
  return FIXED_CATEGORY_NAMES.includes(name);
}
