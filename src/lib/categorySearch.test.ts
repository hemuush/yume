import { searchCategories } from './categoryTree';
import { Category } from '@/types';

const cat = (id: string, name: string, parentId: string | null = null) =>
  ({ id, name, parentId, kind: 'expense', icon: 'tag', color: '#000' }) as Category;
const all = [
  cat('food', 'Food & Dining'),
  cat('caf', 'Office Cafeteria', 'food'),
  cat('travel', 'Travel'),
  cat('rapido', 'Rapido', 'travel'),
  cat('fuel', 'Fuel'),
];

describe('searchCategories', () => {
  it('finds subcategories as well as top-level ones, ignoring case', () => {
    expect(searchCategories(all, 'RAP').map((c) => c.id)).toEqual(['rapido']);
    expect(searchCategories(all, 'caf').map((c) => c.id)).toEqual(['caf']);
  });

  it('puts names that start with the text before names that only contain it', () => {
    expect(searchCategories(all, 'f').map((c) => c.id)).toEqual(['food', 'fuel', 'caf']);
  });

  it('finds nothing for a blank search', () => {
    expect(searchCategories(all, '  ')).toEqual([]);
  });
});
