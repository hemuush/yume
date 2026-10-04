/** The category sheet: creating, editing, one-level nesting, the built-in category rules, and failures. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

const mockCreate = jest.fn(async (..._a: unknown[]) => undefined as unknown);
const mockUpdate = jest.fn(async (..._a: unknown[]) => undefined as unknown);
jest.mock('@/db/ledger', () => ({
  createCategory: (...a: unknown[]) => mockCreate(...a),
  updateCategory: (...a: unknown[]) => mockUpdate(...a),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
  SheetLink: (p: object) => require('react').createElement(require('react-native').Pressable, p),
}));
function mockStub(testID: string) {
  return (p: object) => require('react').createElement(require('react-native').View, { testID, ...p });
}
jest.mock('@/components/FormInput', () => ({ FormInput: mockStub('name') }));
jest.mock('@/components/SegmentedControl', () => ({ SegmentedControl: mockStub('kind') }));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: mockStub('sensitive') }));
jest.mock('@/components/SheetCard', () => ({ SheetCard: mockStub('card') }));
jest.mock('@/components/CategoryIcon', () => ({ CategoryIcon: () => null }));

import { AddCategoryModal } from './AddCategoryModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SheetLink } from '@/components/ModalSheet';
import { CATEGORY_COLOR_PALETTE } from '@/constants/theme';
import { CATEGORY_ICON_CHOICES } from '@/constants/categories';
import type { Category } from '@/types';

const cat = (over: Partial<Category> & Pick<Category, 'id' | 'name'>) =>
  ({
    kind: 'expense',
    parentId: null,
    icon: CATEGORY_ICON_CHOICES[2],
    color: CATEGORY_COLOR_PALETTE[3],
    archived: false,
    sortOrder: 0,
    isSensitive: false,
    isSystem: false,
    ...over,
  }) as Category;

const food = cat({ id: 'food', name: 'Test Food' });
const eatOut = cat({ id: 'eatout', name: 'Test Eating out', parentId: 'food' });
const salary = cat({ id: 'salary', name: 'Test Salary', kind: 'income' });
const all = [food, eatOut, salary];

const mounted: ReactTestRenderer[] = [];
const byId = (t: ReactTestRenderer, id: string) => t.root.findByProps({ testID: id });
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const pressable = (t: ReactTestRenderer, label: string) =>
  t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const parentChoices = (t: ReactTestRenderer) => [
  ...new Set(
    t.root
      .findAll((n) => n.props.accessibilityRole === 'radio')
      .map((n) => n.props.accessibilityLabel as string)
  ),
];

const element = (visible: boolean, category: Category | null, extra: object = {}) => (
  <AddCategoryModal
    visible={visible}
    category={category}
    allCategories={all}
    onClose={jest.fn()}
    onSaved={jest.fn()}
    {...extra}
  />
);
async function render(category: Category | null = null, extra: object = {}) {
  const onSaved = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element(true, category, { onSaved, ...extra }));
  });
  mounted.push(tree);
  return { tree, onSaved };
}
const save = (t: ReactTestRenderer) =>
  act(async () => {
    await t.root.findByType(PrimaryButton).props.onPress();
  });
const type = (t: ReactTestRenderer, name: string) =>
  act(async () => byId(t, 'name').props.onChangeText(name));

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockCreate.mockImplementation(async () => undefined);
  mockUpdate.mockImplementation(async () => undefined);
});

describe('AddCategoryModal — new category', () => {
  it('needs a name before it saves', async () => {
    const { tree, onSaved } = await render();
    await save(tree);
    expect(texts(tree)).toContain('Enter a name');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('creates an expense with the first colour and icon unless told otherwise', async () => {
    const { tree, onSaved } = await render();
    await type(tree, '  Pet Care  ');
    await save(tree);
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Pet Care',
      kind: 'expense',
      color: CATEGORY_COLOR_PALETTE[0],
      icon: CATEGORY_ICON_CHOICES[0],
      parentId: null,
      isSensitive: false,
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('sends the chosen type, colour, icon and sensitivity', async () => {
    const { tree } = await render();
    await type(tree, 'Side income');
    act(() => byId(tree, 'kind').props.onChange('income'));
    act(() => pressable(tree, `Colour 3 of ${CATEGORY_COLOR_PALETTE.length}`).props.onPress());
    act(() => pressable(tree, `${CATEGORY_ICON_CHOICES[1].replace(/-/g, ' ')} icon`).props.onPress());
    act(() => byId(tree, 'sensitive').props.onChange(true));
    await save(tree);
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Side income',
      kind: 'income',
      color: CATEGORY_COLOR_PALETTE[2],
      icon: CATEGORY_ICON_CHOICES[1],
      parentId: null,
      isSensitive: true,
    });
  });

  it('offers only top-level categories of the same type as a parent, and forgets one when the type changes', async () => {
    const { tree } = await render();
    expect(parentChoices(tree)).toEqual(['No parent category', 'Inside Test Food']);

    await type(tree, 'Snacks');
    act(() => pressable(tree, 'Inside Test Food').props.onPress());
    expect(byId(tree, 'card').props.meta).toBe('Inside Test Food');

    act(() => byId(tree, 'kind').props.onChange('income'));
    expect(parentChoices(tree)).toEqual(['No parent category', 'Inside Test Salary']);
    expect(byId(tree, 'card').props.meta).toBeUndefined();
    await save(tree);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'income', parentId: null }));
  });

  it('saves a subcategory under the parent that was picked', async () => {
    const { tree } = await render();
    await type(tree, 'Snacks');
    act(() => pressable(tree, 'Inside Test Food').props.onPress());
    await save(tree);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'food' }));
  });

  it('shows a failure, stays open and does not report success', async () => {
    mockCreate.mockRejectedValueOnce(new Error('disk full'));
    const { tree, onSaved } = await render();
    await type(tree, 'Pet Care');
    await save(tree);
    expect(texts(tree)).toContain('disk full');
    expect(onSaved).not.toHaveBeenCalled();
    expect(tree.root.findByType(PrimaryButton).props.disabled).toBe(false);
  });

  it('starts blank every time it opens', async () => {
    const { tree } = await render();
    await type(tree, 'Pet Care');
    act(() => byId(tree, 'sensitive').props.onChange(true));
    act(() => tree.update(element(false, null)));
    act(() => tree.update(element(true, null)));
    expect(byId(tree, 'name').props.value).toBe('');
    expect(byId(tree, 'sensitive').props.value).toBe(false);
  });
});

describe('AddCategoryModal — editing', () => {
  it('opens on the category, with its type fixed', async () => {
    const own = cat({ id: 'fuel', name: 'Test Fuel', isSensitive: true });
    const { tree } = await render(own);
    expect(byId(tree, 'name').props.value).toBe('Test Fuel');
    expect(byId(tree, 'sensitive').props.value).toBe(true);
    expect(() => byId(tree, 'kind')).toThrow();
    expect(texts(tree).some((t) => t.includes("can't be changed once a category exists"))).toBe(true);
  });

  it('updates in place — never creates — and cannot send a type', async () => {
    const own = cat({ id: 'fuel', name: 'Test Fuel' });
    const { tree, onSaved } = await render(own);
    await type(tree, 'Test Petrol');
    act(() => pressable(tree, 'Inside Test Food').props.onPress());
    await save(tree);
    expect(mockUpdate).toHaveBeenCalledWith('fuel', {
      name: 'Test Petrol',
      icon: own.icon,
      color: own.color,
      parentId: 'food',
      isSensitive: false,
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('lets a subcategory move back to the top level', async () => {
    const { tree } = await render(eatOut);
    expect(parentChoices(tree)).toEqual(['Top level, no parent category', 'Inside Test Food']);
    act(() => pressable(tree, 'Top level, no parent category').props.onPress());
    await save(tree);
    expect(mockUpdate).toHaveBeenCalledWith('eatout', expect.objectContaining({ parentId: null }));
  });

  it('gives no parent picker to a category that has subcategories of its own', async () => {
    const { tree } = await render(food);
    expect(parentChoices(tree)).toEqual([]);
  });

  it('locks the name of a built-in category and hides Archive or delete for it', async () => {
    const builtIn = cat({ id: 'loans', name: 'Test Loans', isSystem: true });
    const { tree } = await render(builtIn, { onManage: jest.fn() });
    expect(byId(tree, 'name').props.editable).toBe(false);
    expect(tree.root.findAllByType(SheetLink)).toHaveLength(0);
    expect(texts(tree).some((t) => t.startsWith('Built-in category'))).toBe(true);
  });

  it('offers Archive or delete for your own category, and opens it', async () => {
    const onManage = jest.fn();
    const own = cat({ id: 'fuel', name: 'Test Fuel' });
    const { tree } = await render(own, { onManage });
    act(() => tree.root.findByType(SheetLink).props.onPress());
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  it('does not offer Archive or delete when adding a new category', async () => {
    const { tree } = await render(null, { onManage: jest.fn() });
    expect(tree.root.findAllByType(SheetLink)).toHaveLength(0);
  });
});
