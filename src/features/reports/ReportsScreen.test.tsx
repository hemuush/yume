/**
 * The Reports screen, assembled from its section components: with a month of
 * spending it shows the headline, "In short", the heatmap, the moon card,
 * "Where it went", and both trends; tapping a category with no subcategories
 * opens its transactions.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('expo-router', () => ({
  router: { setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
// Sheets render their content only while open; the real one needs the keyboard controller's native module.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, title, children }: { visible: boolean; title?: string; children: unknown }) =>
    visible
      ? require('react').createElement(
          require('react').Fragment,
          null,
          require('react').createElement(require('react-native').Text, null, title),
          children
        )
      : null,
}));
// Count-up and bar-fill animations would keep ticking past the test's end.
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
jest.mock('@/features/reports/AnimatedCategoryFill', () => ({ AnimatedCategoryFill: () => null }));

const cat = (categoryId: string, name: string, totalMinor: number) => ({
  categoryId,
  name,
  color: '#8FCBFF',
  totalMinor,
  hasSubcategories: false,
  isSensitive: false,
});
const summary = (breakdown: ReturnType<typeof cat>[]) => ({
  incomeMinor: 0,
  expenseMinor: breakdown.reduce((s, c) => s + c.totalMinor, 0),
  netMinor: 0,
  savingsContributionMinor: 0,
  categoryBreakdown: breakdown,
});
jest.mock('@/db/reports', () => ({
  ...jest.requireActual('@/db/reports'),
  getRangeComparison: async () => ({
    period: 'month',
    current: summary([cat('rent', 'Rent', 1800000), cat('food', 'Food', 620000)]),
    previous: summary([cat('rent', 'Rent', 1800000), cat('food', 'Food', 410000)]),
    incomeChangePct: null,
    expenseChangePct: null,
  }),
  getMonthlyExpenseTrend: async () =>
    ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((label) => ({ label, totalMinor: 2200000 })),
  getNetWorthTrend: async () =>
    ['Jul', 'Aug', 'Sep'].map((label, i) => ({ label, netWorthMinor: 10000000 + i * 500000 })),
  getDailyExpenseTotals: async () => [{ date: '2026-09-05', totalMinor: 620000 }],
  getSubcategoryBreakdown: async () => [],
}));
const mockListTransactions = jest.fn(async () => [
  {
    id: 't1',
    type: 'expense',
    amountMinor: 620000,
    date: '2026-09-05',
    note: 'Groceries',
    categoryId: 'food',
  },
]);
jest.mock('@/db/ledger', () => ({
  listTransactions: (...args: unknown[]) => mockListTransactions(...(args as [])),
  listCategories: async () => [],
}));

import ReportsScreen from '../../../app/(tabs)/reports';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ReportsScreen />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

// Loads React Native's lazily-required components once, with a generous budget.
beforeAll(async () => {
  await render();
}, 180000);

describe('Reports screen', () => {
  it('shows every section for a month with spending', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'Overview',
        'Categories',
        'Trends',
        'Day by day',
        'Fixed vs flexible',
        'Where it went',
        'Rent',
        'Food',
        'Recurring',
        'Discretionary',
        'Net worth',
        'Against your last 7 months',
      ])
    );
    expect(shown.some((t) => t.startsWith('Spent in '))).toBe(true);
  });

  it("tapping a category without subcategories lists that category's transactions", async () => {
    const tree = await render();
    const food = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === 'Food')
    );
    await act(async () => {
      food.props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockListTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'food', includeSubcategories: true })
    );
    expect(texts(tree)).toContain('Groceries');
  });
});
