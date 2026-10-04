/** Activity's filter sheet: what it opens on, how the type narrows categories, and what Apply / Clear hand back. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(120000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
jest.mock('@/components/SegmentedControl', () => ({
  SegmentedControl: (p: { value: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'type', ...p }),
}));

import { FilterModal, type ActivityFilter } from './FilterModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import type { Account, Category } from '@/types';

const cat = (id: string, name: string, kind: Category['kind'], parentId: string | null = null) =>
  ({
    id,
    name,
    kind,
    parentId,
    icon: 'tag',
    color: '#999999',
    archived: false,
    sortOrder: 0,
    isSensitive: false,
    isSystem: false,
  }) as Category;
const categories = [
  cat('food', 'Test Food', 'expense'),
  cat('eatout', 'Test Eating out', 'expense', 'food'),
  cat('fuel', 'Test Fuel', 'expense'),
  cat('pay', 'Test Pay', 'income'),
];
const acc = (id: string, name: string) => ({ id, name, type: 'bank', currency: 'INR' }) as Account;
const accounts = [acc('a1', 'Test Bank'), acc('a2', 'Test Cash')];

const none: ActivityFilter = { type: 'all', categoryIds: [], accountIds: [] };
const mounted: ReactTestRenderer[] = [];
const labels = (t: ReactTestRenderer) => t.root.findAllByType(Chip).map((c) => c.props.label);
const chip = (t: ReactTestRenderer, label: string) =>
  t.root.findAllByType(Chip).find((c) => c.props.label === label)!;
const typeControl = (t: ReactTestRenderer) => t.root.findByProps({ testID: 'type' });
const button = (t: ReactTestRenderer, title: string) =>
  t.root.findAllByType(PrimaryButton).find((b) => b.props.title === title)!;

function element(visible: boolean, filter: ActivityFilter, onApply = jest.fn(), accs = accounts) {
  return (
    <FilterModal
      visible={visible}
      categories={categories}
      accounts={accs}
      filter={filter}
      onClose={jest.fn()}
      onApply={onApply}
    />
  );
}
function render(filter: ActivityFilter = none, accs = accounts) {
  const onApply = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element(true, filter, onApply, accs));
  });
  mounted.push(tree);
  return { tree, onApply };
}

afterEach(() => act(() => mounted.splice(0).forEach((t) => t.unmount())));

describe('FilterModal', () => {
  it('opens on the filter already applied', () => {
    const { tree } = render({ type: 'expense', categoryIds: ['fuel'], accountIds: ['a2'] });
    expect(typeControl(tree).props.value).toBe('expense');
    expect(chip(tree, 'Test Fuel').props.active).toBe(true);
    expect(chip(tree, 'Test Food').props.active).toBe(false);
    expect(chip(tree, 'Test Cash').props.active).toBe(true);
    expect(chip(tree, 'Test Bank').props.active).toBe(false);
  });

  it('shows only top-level categories until one with subcategories is tapped', () => {
    const { tree } = render();
    expect(labels(tree)).toEqual(
      expect.arrayContaining(['Test Food', 'Test Fuel', 'Test Pay', 'Test Bank', 'Test Cash'])
    );
    expect(labels(tree)).not.toContain('Test Eating out');

    act(() => chip(tree, 'Test Food').props.onPress());
    expect(chip(tree, 'Test Food').props.active).toBe(true);
    expect(labels(tree)).toContain('Test Eating out');

    act(() => chip(tree, 'Test Fuel').props.onPress());
    expect(labels(tree)).not.toContain('Test Eating out');
  });

  it('lets a category be switched off again by tapping it twice', () => {
    const { tree } = render();
    act(() => chip(tree, 'Test Fuel').props.onPress());
    act(() => chip(tree, 'Test Fuel').props.onPress());
    expect(chip(tree, 'Test Fuel').props.active).toBe(false);
  });

  it('narrows the categories to the chosen type and drops picks of the other kind', () => {
    const { tree, onApply } = render({ type: 'all', categoryIds: ['fuel', 'pay'], accountIds: [] });
    act(() => typeControl(tree).props.onChange('income'));
    expect(labels(tree)).toContain('Test Pay');
    expect(labels(tree)).not.toContain('Test Fuel');
    act(() => button(tree, 'Apply').props.onPress());
    expect(onApply).toHaveBeenCalledWith({ type: 'income', categoryIds: ['pay'], accountIds: [] });
  });

  it('keeps every pick while the type stays on All', () => {
    const { tree, onApply } = render({ type: 'all', categoryIds: ['fuel', 'pay'], accountIds: [] });
    act(() => button(tree, 'Apply').props.onPress());
    expect(onApply).toHaveBeenCalledWith({ type: 'all', categoryIds: ['fuel', 'pay'], accountIds: [] });
  });

  it('hides the category chips for transfers, which have no categories of their own', () => {
    const { tree } = render();
    act(() => typeControl(tree).props.onChange('transfer'));
    expect(labels(tree)).not.toContain('Test Fuel');
    expect(labels(tree)).toContain('Test Bank');
  });

  it('offers the account filter only when there is more than one account', () => {
    const { tree } = render(none, [acc('a1', 'Test Bank')]);
    expect(labels(tree)).not.toContain('Test Bank');
  });

  it('applies the chosen accounts and categories together', () => {
    const { tree, onApply } = render();
    act(() => chip(tree, 'Test Bank').props.onPress());
    act(() => chip(tree, 'Test Cash').props.onPress());
    act(() => chip(tree, 'Test Cash').props.onPress());
    act(() => chip(tree, 'Test Fuel').props.onPress());
    act(() => button(tree, 'Apply').props.onPress());
    expect(onApply).toHaveBeenCalledWith({ type: 'all', categoryIds: ['fuel'], accountIds: ['a1'] });
  });

  it('clears every filter in one tap, whatever is picked in the sheet', () => {
    const { tree, onApply } = render({ type: 'expense', categoryIds: ['fuel'], accountIds: ['a1'] });
    act(() => button(tree, 'Clear filters').props.onPress());
    expect(onApply).toHaveBeenCalledWith(none);
  });

  it('forgets unapplied picks when it is reopened', () => {
    const { tree } = render();
    act(() => chip(tree, 'Test Fuel').props.onPress());
    act(() => typeControl(tree).props.onChange('expense'));
    act(() => tree.update(element(false, none)));
    act(() => tree.update(element(true, none)));
    expect(typeControl(tree).props.value).toBe('all');
    expect(chip(tree, 'Test Fuel').props.active).toBe(false);
  });
});
