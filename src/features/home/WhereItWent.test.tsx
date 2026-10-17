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
        onOpenReports={onOpenReports}
        onOpenCategory={onOpenCategory}
        onAddExpense={onAddExpense}
      />
    );
  });
  return r;
}

describe('Where it went', () => {
  beforeEach(() => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 800,
      scale: 3,
      fontScale: 1,
    });
  });
  afterEach(() => jest.restoreAllMocks());
  // Hidden (sensitive) groups are left out before the dial sees them (privateComparison), so none here.
  const breakdown = [cat('Food', 1_600_000), cat('Rent', 2_400_000), cat('Shares', 1_000_000)];

  it.each([
    { width: 320, fontScale: 1 },
    { width: 390, fontScale: 1.5 },
  ])('keeps selection and drill-through reachable at $width dp and $fontScale text scale', (size) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ ...size, height: 800, scale: 3 });
    const openReports = jest.fn();
    const openCategory = jest.fn();
    const r = render(breakdown, openReports, openCategory);
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'Shares, 20% of spending' && n.props.onPress)
        .props.onPress()
    );
    expect(texts(r)).toContain('₹10,000 · 20%');
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'View Shares category' && n.props.onPress)
        .props.onPress()
    );
    expect(openCategory).toHaveBeenCalledWith('Shares');
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'All categories in Reports' && n.props.onPress)
        .props.onPress()
    );
    expect(openReports).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it('picks the biggest category, and repeats neither the month total nor the change from last month', () => {
    const all = texts(render(breakdown));
    expect(all).toEqual(expect.arrayContaining(['Rent', '₹24,000 · 48%', '48%']));
    // The month card above says what was spent; the card does not say it again.
    expect(all.some((t) => t.startsWith('Spent in'))).toBe(false);
    expect(all).not.toContain('₹50,000');
    expect(all.some((t) => t.includes('less than') || t.includes('more than'))).toBe(false);
  });

  it('shows the selected category immediately', () => {
    const r = render(breakdown);
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'Shares, 20% of spending' && n.props.onPress)
        .props.onPress()
    );
    const all = texts(r);
    expect(all).toEqual(expect.arrayContaining(['Shares', '₹10,000 · 20%', '20%']));
    expect(all).not.toContain('₹16,000 · 32%');
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

  it('offers an expense action for a period with no spending', () => {
    const add = jest.fn();
    const r = render([], jest.fn(), jest.fn(), add);
    expect(texts(r)).toContain('No spending yet');
    act(() =>
      r.root.find((n) => n.props.accessibilityLabel === 'Add expense' && n.props.onPress).props.onPress()
    );
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('keeps shares based on all categories and offers the remaining categories in Reports', () => {
    const tree = render(['A', 'B', 'C', 'D', 'E'].map((name) => cat(name, 10000)));
    const shown = texts(tree);
    expect(shown).toContain('₹100 · 20%');
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === 'All categories in Reports').length
    ).toBeGreaterThan(0);
    expect(shown).not.toContain('E');
  });
});

it('opens the selected category only from its detail action', () => {
  const open = jest.fn();
  const r = render([cat('Food', 10000), cat('Rent', 20000)], jest.fn(), open);
  act(() =>
    r.root
      .find((n) => n.props.accessibilityLabel === 'Food, 33% of spending' && n.props.onPress)
      .props.onPress()
  );
  expect(open).not.toHaveBeenCalled();
  act(() =>
    r.root.find((n) => n.props.accessibilityLabel === 'View Food category' && n.props.onPress).props.onPress()
  );
  expect(open).toHaveBeenCalledWith('Food');
});

it('does not retain a selected category after privacy-filtered inputs remove it', () => {
  const tree = render([cat('Private', 20000, true), cat('Public', 10000)]);
  expect(texts(tree)).toContain('Private');
  const props = tree.root.findByType(WhereItWent).props as Parameters<typeof WhereItWent>[0];
  act(() => tree.update(<WhereItWent {...props} breakdown={[cat('Public', 10000)]} spentMinor={10000} />));
  expect(texts(tree)).not.toContain('Private');
  expect(texts(tree)).toContain('₹100 · 100%');
  act(() => tree.unmount());
});
it('keeps shares on net spending without a long disclaimer', () => {
  const tree = render([cat('Food', 10000), cat('Refunds', -5000)]);
  expect(texts(tree)).toContain('₹100 · 100%');
  // No long disclaimer under the figure: the share is on the category line and the net total above it.
  expect(texts(tree).some((t) => t.includes('refunds are included in the period total'))).toBe(false);
  act(() => tree.unmount());
});
