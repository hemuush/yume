/**
 * The Categories tile grid: every top-level category in one A-Z grid, a parent's pills open in a panel under its
 * row, a childless tile edits straight away, and long press goes to the manage menu.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import type { Category } from '@/types';

jest.setTimeout(30000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { CategorySection } from './CategorySection';

const cat = (id: string, name: string, parentId: string | null = null): Category =>
  ({
    id,
    name,
    icon: 'tag',
    color: '#FFB4A2',
    kind: 'expense',
    parentId,
    archived: false,
    isSystem: false,
    isSensitive: false,
  }) as Category;

const cats = [
  cat('food', 'Food & Dining'),
  cat('rent', 'Rent'),
  cat('travel', 'Transportation & Travel Costs'),
  cat('gifts', 'Gifts'),
  cat('health', 'Health'),
  cat('swiggy', 'Swiggy', 'food'),
  cat('cafes', 'Cafes', 'food'),
];

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const pressable = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

async function render(onEdit = jest.fn(), onManage = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CategorySection cats={cats} onEdit={onEdit} onManage={onManage} />);
  });
  return { tree, onEdit, onManage };
}

beforeAll(async () => {
  await render();
}, 120000);

describe('Categories · tile grid', () => {
  it('lists only top-level categories, in the order given, with long names left whole and wrapping', async () => {
    const { tree } = await render();
    const shown = texts(tree);
    expect(shown).toContain('Food & Dining');
    expect(shown).toContain('Transportation & Travel Costs');
    expect(shown).not.toContain('Swiggy');

    const name = tree.root
      .findAllByType(Text)
      .find((t) => t.props.children === 'Transportation & Travel Costs');
    expect(name?.props.numberOfLines).toBe(2);
  });

  it('badges a parent with its subcategory count and edits a childless tile on tap', async () => {
    const { tree, onEdit } = await render();
    expect(texts(tree)).toContain('2');
    act(() => pressable(tree, 'Rent').props.onPress());
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'rent' }));
  });

  it('opens a parent into a panel of its pills instead of editing, and closes it on a second tap', async () => {
    const { tree, onEdit } = await render();
    const label = 'Food & Dining, 2 subcategories';
    expect(texts(tree)).not.toContain('Swiggy');

    act(() => pressable(tree, label).props.onPress());
    expect(onEdit).not.toHaveBeenCalled();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Swiggy', 'Cafes']));
    expect(pressable(tree, label).props.accessibilityState).toEqual({ expanded: true });

    act(() => pressable(tree, label).props.onPress());
    expect(texts(tree)).not.toContain('Swiggy');
  });

  it("edits the parent from the panel's header and a subcategory from its pill", async () => {
    const { tree, onEdit } = await render();
    act(() => pressable(tree, 'Food & Dining, 2 subcategories').props.onPress());

    act(() => pressable(tree, 'Edit Food & Dining').props.onPress());
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'food' }));

    const pill = tree.root.find(
      (n) =>
        typeof n.props.onLongPress === 'function' &&
        n.findAllByType(Text).some((t) => t.props.children === 'Cafes')
    );
    act(() => pill.props.onPress());
    expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'cafes' }));
  });

  it('long press on a tile or a pill goes to the manage menu', async () => {
    const { tree, onManage } = await render();
    act(() => pressable(tree, 'Rent').props.onLongPress());
    expect(onManage).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'rent' }));

    act(() => pressable(tree, 'Food & Dining, 2 subcategories').props.onPress());
    const pill = tree.root.find(
      (n) =>
        typeof n.props.onLongPress === 'function' &&
        n.findAllByType(Text).some((t) => t.props.children === 'Swiggy')
    );
    act(() => pill.props.onLongPress());
    expect(onManage).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'swiggy' }));
  });
});
