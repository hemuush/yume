/**
 * The category grid fills its width with equal columns (no lopsided last row), and a category the host
 * marks as taken (a split's other parts) shows faded.
 */
import { Text, TextInput, View } from 'react-native';
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

let textScale = 1;
beforeEach(() => {
  textScale = 1;
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockImplementation(() => ({ width: 411, height: 800, fontScale: textScale, scale: 1 }));
});
afterEach(() => jest.restoreAllMocks());

function render(dimmedIds?: string[], minColumnWidth?: number) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <CategoryPicker
        categories={cats}
        selectedId={null}
        onSelect={jest.fn()}
        variant="medal"
        dimmedIds={dimmedIds}
        minColumnWidth={minColumnWidth}
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
  it('keeps subcategory discovery and search selection working in compact mode', () => {
    const onSelect = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <CategoryPicker
          categories={[...cats, { ...cats[0], id: 'coffee', name: 'Coffee', parentId: 'c0' }]}
          selectedId={null}
          onSelect={onSelect}
          variant="medal"
          compact
          searchable
        />
      );
    });
    act(() => tileOf(tree, 'Food').props.onPress());
    expect(tree.root.findAllByType(Text).some((n) => n.props.children === 'Coffee')).toBe(true);
    act(() => tree.root.findByType(TextInput).props.onChangeText('Coffee'));
    act(() => tileOf(tree, 'Coffee').props.onPress());
    expect(onSelect.mock.calls.map(([id]) => id)).toEqual(['c0', 'coffee']);
    expect(tree.root.findByType(TextInput).props.value).toBe('');
    act(() => tree.unmount());
  });

  it('gives transaction category names wider columns when requested', () => {
    const r = render(undefined, 80);
    expect(flat(tileOf(r, 'Food').props.style).width).toBe(92);
    const grid = r.root.find((n) => n.type === View && typeof n.props.onLayout === 'function');
    act(() => grid.props.onLayout({ nativeEvent: { layout: { width: 284, height: 0, x: 0, y: 0 } } }));
    expect(flat(tileOf(r, 'Food').props.style).width).toBe(94);
  });
  it('splits the width into equal columns', () => {
    const r = render();
    // 371 / 80 → 4 columns of 92 px.
    expect(flat(tileOf(r, 'Food').props.style).width).toBe(92);
    expect(flat(tileOf(r, 'Rent').props.style).width).toBe(92);
  });

  it.each([
    [1.3, 92],
    [1.5, 123],
    [2, 185],
  ])(
    'at text scale %s a column is %i px: past 130% the names stop shrinking, so they get wider columns',
    (scale, width) => {
      textScale = scale;
      const r = render();
      expect(flat(tileOf(r, 'Food').props.style).width).toBe(width);
    }
  );

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
