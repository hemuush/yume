/** Home's "Where it went" dial: the period's spending and the picked category's share. Figures are made up. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// Icons draw nothing here: their font load would update state after each test.
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));

import { WhereItWent } from './WhereItWent';
import type { CategoryBreakdownItem } from '@/db/reports';

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) =>
    [t.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string' || typeof c === 'number')
      .join('')
  );
const cat = (name: string, totalMinor: number, isSensitive = false): CategoryBreakdownItem => ({
  categoryId: name,
  name,
  color: '#FFA8CE',
  totalMinor,
  hasSubcategories: false,
  isSensitive,
});

function render(breakdown: CategoryBreakdownItem[], onOpenReports = jest.fn()) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <WhereItWent
        breakdown={breakdown}
        iconFor={() => 'food'}
        spentMinor={5_000_000}
        previousSpentMinor={5_421_000}
        periodName="October"
        previousName="Sept"
        onOpenReports={onOpenReports}
      />
    );
  });
  return r;
}

describe('Where it went', () => {
  // Hidden (sensitive) groups are left out before the dial sees them (privateComparison), so none here.
  const breakdown = [cat('Food', 1_600_000), cat('Rent', 2_400_000), cat('Shares', 1_000_000)];

  it('shows the spending, the change from last period, and the biggest category picked', () => {
    const all = texts(render(breakdown));
    expect(all).toEqual(
      expect.arrayContaining([
        'Spent in October',
        '₹50,000',
        '₹4,210 less than Sept',
        'Food',
        '₹16,000 · 32% of spending',
      ])
    );
  });

  it('selects a category without hiding the other category amounts', () => {
    const r = render(breakdown);
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'Shares, 20% of spending' && n.props.onPress)
        .props.onPress()
    );
    const all = texts(r);
    expect(all).toEqual(expect.arrayContaining(['Shares', '₹10,000 · 20% of spending', '20%']));
    expect(all).toContain('₹16,000 · 32% of spending');
    expect(
      r.root.findAll((n) => n.props.accessibilityLabel === 'Shares, 20% of spending')[0].props
        .accessibilityState.selected
    ).toBe(true);
  });

  it('opens Reports from the last bubble', () => {
    const open = jest.fn();
    const r = render(breakdown, open);
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'All categories in Reports' && n.props.onPress)
        .props.onPress()
    );
    expect(open).toHaveBeenCalled();
  });

  it('draws nothing for a period with no spending', () => {
    expect(render([]).toJSON()).toBeNull();
  });

  it('keeps shares based on all categories and offers the remaining categories in Reports', () => {
    const tree = render(['A', 'B', 'C', 'D', 'E'].map((name) => cat(name, 10000)));
    const shown = texts(tree);
    expect(shown).toContain('₹100 · 20% of spending');
    expect(shown).toContain('View all 5 categories');
    expect(shown).not.toContain('E');
  });
});
