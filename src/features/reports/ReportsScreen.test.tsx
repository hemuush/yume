/**
 * The Reports screen, assembled from its section components: with a month of
 * spending it shows the heatmap card (with the headline in it), the story
 * cards, "Where it went" and the trend chart; tapping a category with no
 * subcategories opens its transactions. The Income switch lists where money
 * came from (pointing at Tidy up when starting balances dominate), and a
 * custom range carries through to the category page. (The story cards, mosaic and chart
 * draw once they've measured their width, which the test renderer never
 * does — their own logic is tested in reportsInsights / mosaicLayout.)
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
const mockSearch = { current: {} as Record<string, string> };
jest.mock('expo-router', () => ({
  router: { setParams: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockSearch.current,
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
// Sheets render their content only while open; the real one needs the keyboard controller's native module.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({
    visible,
    title,
    children,
    footer,
  }: {
    visible: boolean;
    title?: string;
    children: unknown;
    footer?: unknown;
  }) =>
    visible
      ? require('react').createElement(
          require('react').Fragment,
          null,
          require('react').createElement(require('react-native').Text, null, title),
          children,
          footer
        )
      : null,
}));
jest.mock('@/db/tidyUp', () => ({
  getTidyUpReport: async () => ({
    repeats: [],
    startingBalances: [{ categoryName: 'Previous' }],
    fractionalCount: 0,
  }),
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
const summary = (breakdown: ReturnType<typeof cat>[], income: ReturnType<typeof cat>[] = []) => ({
  incomeMinor: income.reduce((s, c) => s + c.totalMinor, 0),
  expenseMinor: breakdown.reduce((s, c) => s + c.totalMinor, 0),
  netMinor: 0,
  savingsContributionMinor: 0,
  categoryBreakdown: breakdown,
  incomeBreakdown: income,
});
jest.mock('@/db/reports', () => ({
  ...jest.requireActual('@/db/reports'),
  getRangeComparison: async () => ({
    period: 'month',
    current: summary(
      [cat('rent', 'Rent', 1800000), cat('food', 'Food', 620000)],
      [cat('prev', 'Previous', 9200000), cat('salary', 'Salary', 7500000)]
    ),
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

// Bars and rings animate to their values (useGrowFrom, at most the 700ms draw):
// let the last ones finish before the file ends, so no frame fires after teardown.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 800)));

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
// The innermost pressable showing exactly this text.
const pressText = async (tree: ReactTestRenderer, label: string) => {
  const node = tree.root
    .findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label)
    )
    .at(-1)!;
  await act(async () => {
    node.props.onPress();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

// Loads React Native's lazily-required components once, with a generous budget.
beforeAll(async () => {
  await render();
}, 180000);

describe('Reports screen', () => {
  it('shows every section for a month with spending', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'Tap a day to see what went out',
        'Where it went',
        'Rent',
        'Food',
        'Spending',
        'Net worth',
      ])
    );
    expect(shown.some((t) => t.startsWith('Spent in '))).toBe(true);
    expect(shown.some((t) => t.endsWith(', in short'))).toBe(true);
    // The heatmap card leads: its headline comes before "Where it went".
    expect(shown.findIndex((t) => t.startsWith('Spent in '))).toBeLessThan(shown.indexOf('Where it went'));
  });

  it('tapping a category opens its own page, on the same period', async () => {
    const tree = await render();
    const food = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === 'Food')
    );
    await act(async () => {
      food.props.onPress();
    });
    expect(require('expo-router').router.push).toHaveBeenCalledWith('/category/food?g=month&o=0');
  });

  it('switches to where the money came from, and points starting balances at Tidy up', async () => {
    const tree = await render();
    await pressText(tree, 'Income');
    const shown = texts(tree);
    expect(shown).toEqual(expect.arrayContaining(['Where it came from', 'Previous', 'Salary']));
    expect(shown).not.toContain('Where it went');
    expect(shown.some((t) => t.startsWith('Previous is over half of this income'))).toBe(true);
    await pressText(tree, 'Tidy up');
    expect(require('expo-router').router.push).toHaveBeenCalledWith('/tidy-up');
  });

  it('shows a custom range and carries it to the category page', async () => {
    const tree = await render();
    await pressText(tree, 'Custom');
    expect(texts(tree)).toContain('Pick a range');
    await pressText(tree, 'Last 30 days');
    const show = texts(tree).find((t) => t.startsWith('Show '))!;
    await pressText(tree, show);
    expect(texts(tree)).not.toContain('Pick a range');
    await pressText(tree, 'Food');
    const last = (require('expo-router').router.push as jest.Mock).mock.calls.at(-1)[0];
    expect(last).toMatch(/^\/category\/food\?g=custom&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
  });

  it("opens on a week from a link, as the week Wrap's report button sends", async () => {
    mockSearch.current = { from: '2026-09-20', to: '2026-09-26' };
    try {
      const tree = await render();
      await pressText(tree, 'Food');
      const last = (require('expo-router').router.push as jest.Mock).mock.calls.at(-1)[0];
      expect(last).toBe('/category/food?g=custom&from=2026-09-20&to=2026-09-26');
    } finally {
      mockSearch.current = {};
    }
  });

  it('ignores a malformed range link', async () => {
    mockSearch.current = { from: 'yesterday', to: '2026-09-26' };
    try {
      const tree = await render();
      await pressText(tree, 'Food');
      const last = (require('expo-router').router.push as jest.Mock).mock.calls.at(-1)[0];
      expect(last).toBe('/category/food?g=month&o=0');
    } finally {
      mockSearch.current = {};
    }
  });
});
