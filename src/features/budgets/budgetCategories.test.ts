import { budgetCategories } from './budgetCategories';
import type { Category } from '@/types';

it('keeps private families out of new-budget choices, including archived sensitive children', () => {
  const categories = [
    { id: 'parent', kind: 'expense', parentId: null },
    { id: 'private', kind: 'expense', parentId: 'parent', isSensitive: true, archived: true },
    { id: 'sibling', kind: 'expense', parentId: 'parent' },
    { id: 'public', kind: 'expense', parentId: null },
    { id: 'income', kind: 'income', parentId: null },
  ] as Category[];
  expect(budgetCategories(categories, true).map((c) => c.id)).toEqual(['public']);
  expect(budgetCategories(categories, false).map((c) => c.id)).toEqual(['parent', 'sibling', 'public']);
});
