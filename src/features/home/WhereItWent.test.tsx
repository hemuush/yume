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

const ReactNative = require('react-native');

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

function render(
  breakdown: CategoryBreakdownItem[],
  onOpenReports = jest.fn(),
  onOpenCategory = jest.fn(),
  onAddExpense = jest.fn()
) {
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
        onOpenCategory={onOpenCategory}
        onAddExpense={onAddExpense}
      />
    );
  });
  return r;
}

describe('Where it went', () => {
  beforeEach(() =>
    jest
      .spyOn(ReactNative, 'useWindowDimensions')
      .mockReturnValue({ width: 390, height: 800, scale: 3, fontScale: 1 })
  );
  afterEach(() => jest.restoreAllMocks());
  const breakdown = [cat('Food', 1600000), cat('Rent', 2400000), cat('Shares', 1000000)];
  it('shows names, amounts and shares together without repeating the hero total', () => {
    const all = texts(render(breakdown));
    expect(all).toEqual(
      expect.arrayContaining([
        'October spending breakdown',
        '₹4,210 less than Sept',
        'Rent',
        '₹24,000',
        '48% of spending',
        'Food',
        '₹16,000',
      ])
    );
    expect(all).not.toContain('₹50,000');
  });
  it.each([
    { width: 320, fontScale: 1 },
    { width: 390, fontScale: 1.5 },
  ])('keeps direct category and Reports navigation at $width / $fontScale', (size) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ ...size, height: 800, scale: 3 });
    const category = jest.fn();
    const reports = jest.fn();
    const tree = render(breakdown, reports, category);
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel?.startsWith('View Shares category,') && n.props.onPress)
        .props.onPress()
    );
    expect(category).toHaveBeenCalledWith('Shares');
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel === 'All categories in Reports' && n.props.onPress)
        .props.onPress()
    );
    expect(reports).toHaveBeenCalledTimes(1);
  });
  it('offers setup for empty spending', () => {
    const add = jest.fn();
    const tree = render([], jest.fn(), jest.fn(), add);
    expect(texts(tree)).toContain('No spending yet');
    act(() =>
      tree.root.find((n) => n.props.accessibilityLabel === 'Add expense' && n.props.onPress).props.onPress()
    );
    expect(add).toHaveBeenCalledTimes(1);
  });
  it('uses all positive categories for shares while limiting previews to four', () => {
    const all = texts(render(['A', 'B', 'C', 'D', 'E'].map((name) => cat(name, 10000))));
    expect(all).toContain('20% of spending');
    expect(all).not.toContain('E');
  });
  it('explains refund effects instead of pretending positive shares include negative categories', () => {
    const all = texts(render([cat('Food', 10000), cat('Refunds', -5000)]));
    expect(all).toContain('100% of spending');
    expect(all.some((t) => t.includes('refunds are included in the period total'))).toBe(true);
  });
});
