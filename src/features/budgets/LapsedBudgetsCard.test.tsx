/** The "budgets ended last month" strip: one pill for all, a chevron for one by one. Names and amounts are made up. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { LapsedBudgetsCard } from './LapsedBudgetsCard';
import type { LapsedBudget } from '@/db/budgets';

const item = (id: string, name: string): LapsedBudget => ({
  categoryId: id,
  categoryName: name,
  categoryIcon: 'cart-outline',
  categoryColor: '#8FE8C8',
  limitAmountMinor: 500000,
  rollover: false,
});

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
const press = (r: ReactTestRenderer, label: string) =>
  act(() => r.root.find((n) => n.props.accessibilityLabel === label && n.props.onPress).props.onPress());

function render(items: LapsedBudget[], over: Partial<Parameters<typeof LapsedBudgetsCard>[0]> = {}) {
  const props = {
    items,
    continuingId: null,
    continuingAll: false,
    onContinue: jest.fn(),
    onContinueAll: jest.fn(),
    ...over,
  };
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<LapsedBudgetsCard {...props} />);
  });
  return { r, props };
}

describe('LapsedBudgetsCard', () => {
  it('names the budgets and continues them all with one press', () => {
    const { r, props } = render([item('a', 'Groceries'), item('b', 'Fuel')]);
    expect(texts(r)).toContain('2 budgets ended last month');
    expect(texts(r)).toContain('Groceries · Fuel');
    press(r, 'Continue all budgets');
    expect(props.onContinueAll).toHaveBeenCalledTimes(1);
  });

  it('opens the list to continue one at a time', () => {
    const { r, props } = render([item('a', 'Groceries'), item('b', 'Fuel')]);
    expect(texts(r)).not.toContain('₹5,000/mo');
    press(r, 'Choose which to continue');
    expect(texts(r)).toContain('₹5,000/mo');
    const second = r.root.findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityRole === 'button' &&
        !n.props.accessibilityLabel
    );
    act(() => second[1].props.onPress());
    expect(props.onContinue).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'b' }));
  });

  it('is a plain Continue with no list for a single budget', () => {
    const { r, props } = render([item('a', 'Groceries')]);
    expect(texts(r)).toContain('1 budget ended last month');
    expect(texts(r)).toContain('Continue');
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Choose which to continue')).toHaveLength(0);
    press(r, 'Continue budget');
    expect(props.onContinueAll).toHaveBeenCalledTimes(1);
  });
});
