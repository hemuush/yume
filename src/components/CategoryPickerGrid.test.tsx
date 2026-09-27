/**
 * The category grid fills its width evenly — as many equal columns as fit —
 * so a row never ends in a lopsided gap, and a category the host marks as
 * taken (a split's other parts) shows faded.
 */
import { Text, View } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

import { CategoryPicker } from './CategoryPicker';
import { Category } from '@/types';

const cats = ['Food', 'Groceries', 'Transport', 'Shopping', 'Health', 'Fun', 'Rent'].map((name, i) => ({
  id: `c${i}`,
  name,
  kind: 'expense',
  icon: 'tag',
  color: '#8FCBFF',
  parentId: null,
  archived: false,
})) as Category[];

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

function render(dimmedIds?: string[]) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <CategoryPicker
        categories={cats}
        selectedId={null}
        onSelect={jest.fn()}
        variant="medal"
        dimmedIds={dimmedIds}
      />
    );
  });
  // The grid measures itself: 371 px wide, as on a 411 dp phone with 20 px margins.
  const grid = r.root.find((n) => n.type === View && typeof n.props.onLayout === 'function');
  act(() => grid.props.onLayout({ nativeEvent: { layout: { width: 371, height: 0, x: 0, y: 0 } } }));
  return r;
}
const tileOf = (r: ReactTestRenderer, name: string) =>
  r.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.style != null &&
      n.findAllByType(Text).some((t) => t.props.children === name)
  );

describe('category grid', () => {
  it('splits the width into equal columns', () => {
    const r = render();
    // 371 / 70 → 5 columns of 74 px.
    expect(flat(tileOf(r, 'Food').props.style).width).toBe(74);
    expect(flat(tileOf(r, 'Rent').props.style).width).toBe(74);
  });

  it('fades the categories the host marks as taken', () => {
    const r = render(['c1']);
    // The tile's contents (icon and name), which carry the fade.
    const body = (name: string) =>
      flat(
        tileOf(r, name).findAll((n) => n.type === View && flat(n.props.style).alignSelf === 'stretch')[0]
          .props.style
      );
    expect(body('Groceries').opacity).toBe(0.35);
    expect(body('Food').opacity).toBeUndefined();
  });
});
