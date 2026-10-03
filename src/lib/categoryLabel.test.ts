import {
  categoryPath,
  categorySentence,
  categorySpoken,
  inParent,
  joinSub,
  parentNameOf,
} from './categoryLabel';

const byId = new Map([
  ['food', { name: 'Food & Dining', parentId: null }],
  ['groc', { name: 'Groceries', parentId: null }],
  ['flipF', { name: 'Flipkart Minutes', parentId: 'food' }],
  ['flipG', { name: 'Flipkart Minutes', parentId: 'groc' }],
  ['orphan', { name: 'Orphan', parentId: 'gone' }],
]);

describe('categoryLabel', () => {
  it('names the parent of a subcategory, telling same-named children apart', () => {
    expect(parentNameOf('flipF', byId)).toBe('Food & Dining');
    expect(parentNameOf('flipG', byId)).toBe('Groceries');
  });

  it('has no parent for a top-level, unknown, missing or orphaned category', () => {
    expect(parentNameOf('food', byId)).toBeUndefined();
    expect(parentNameOf('nope', byId)).toBeUndefined();
    expect(parentNameOf(null, byId)).toBeUndefined();
    expect(parentNameOf('orphan', byId)).toBeUndefined();
  });

  it('words the parent three ways, and never prefixes a top-level category', () => {
    expect(inParent('Food & Dining')).toBe('in Food & Dining');
    expect(categoryPath('Flipkart Minutes', 'Food & Dining')).toBe('Food & Dining › Flipkart Minutes');
    expect(categorySentence('Flipkart Minutes', 'Food & Dining')).toBe('Flipkart Minutes (Food & Dining)');
    expect(categorySpoken('Flipkart Minutes', 'Food & Dining')).toBe('Flipkart Minutes, in Food & Dining');

    expect(inParent(undefined)).toBeUndefined();
    expect(inParent(null)).toBeUndefined();
    expect(categoryPath('Food & Dining')).toBe('Food & Dining');
    expect(categorySentence('Food & Dining', null)).toBe('Food & Dining');
    expect(categorySpoken('Food & Dining')).toBe('Food & Dining');
  });

  it('joins the parts of a second line and skips the empty ones', () => {
    expect(joinSub(['in Food & Dining', undefined, 'Lunch', '', false, 'HDFC'])).toBe(
      'in Food & Dining · Lunch · HDFC'
    );
    expect(joinSub([undefined, null])).toBe('');
  });
});
