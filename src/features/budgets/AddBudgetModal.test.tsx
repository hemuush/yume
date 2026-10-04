/**
 * The add-budget sheet: it starts on a category that has no budget yet, and starts fresh each time it opens
 * rather than showing what was typed last time. Categories are made up.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import type { Category } from '@/types';

jest.setTimeout(120000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));
jest.mock('@/components/SheetCard', () => ({ SheetCard: () => null }));
jest.mock('@/components/AmountField', () => ({
  AmountField: () => null,
}));
jest.mock('@/components/CategoryPicker', () => ({
  CategoryPicker: () => null,
}));
jest.mock('@/db/budgets', () => ({ createBudget: jest.fn(async () => {}), updateBudget: jest.fn() }));

import { AmountField } from '@/components/AmountField';
import { CategoryPicker } from '@/components/CategoryPicker';
import { AddBudgetModal, defaultBudgetCategoryId } from './AddBudgetModal';

const cat = (id: string, over: Partial<Category> = {}): Category => ({
  id,
  name: `Cat ${id}`,
  kind: 'expense',
  parentId: null,
  icon: 'cart-outline',
  color: '#8FE8C8',
  archived: false,
  sortOrder: 0,
  isSensitive: false,
  isSystem: false,
  ...over,
});
const categories = [cat('food'), cat('fuel'), cat('bus', { parentId: 'fuel' })];

describe('defaultBudgetCategoryId', () => {
  it('prefers the first top-level category without a budget', () => {
    expect(defaultBudgetCategoryId(categories, new Set(['food']))).toBe('fuel');
    expect(defaultBudgetCategoryId(categories)).toBe('food');
  });

  it('falls back to a sub-category when every top-level one is budgeted, and to none when all are', () => {
    expect(defaultBudgetCategoryId(categories, new Set(['food', 'fuel']))).toBe('bus');
    expect(defaultBudgetCategoryId(categories, new Set(['food', 'fuel', 'bus']))).toBeNull();
    expect(defaultBudgetCategoryId([])).toBeNull();
  });
});

function element(visible: boolean, budgeted?: Set<string>) {
  return (
    <AddBudgetModal
      visible={visible}
      editing={null}
      categories={categories}
      budgetedCategoryIds={budgeted}
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />
  );
}
const field = (r: ReactTestRenderer) => r.root.findByType(AmountField);
const picker = (r: ReactTestRenderer) => r.root.findByType(CategoryPicker);

describe('AddBudgetModal', () => {
  // Warms React Native's lazily-required modules once, with a generous budget.
  beforeAll(() => {
    act(() => {
      create(element(false));
    });
  }, 180000);

  it('opens on a category that has no budget yet, and takes whole numbers only', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(element(true, new Set(['food'])));
    });
    expect(picker(r).props.selectedId).toBe('fuel');
    expect(field(r).props.decimal).toBe(false);
  });

  it('starts fresh when it is opened again', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(element(true));
    });
    act(() => {
      field(r).props.onChangeText('4000');
      picker(r).props.onSelect('fuel');
    });
    expect(field(r).props.value).toBe('4000');
    expect(picker(r).props.selectedId).toBe('fuel');

    act(() => r.update(element(false)));
    act(() => r.update(element(true)));
    expect(field(r).props.value).toBe('');
    expect(picker(r).props.selectedId).toBe('food');
  });
});
