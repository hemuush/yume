/**
 * Reports assembled: three lenses (Days heatmap + story cards, Categories, Trends), the
 * Income switch, and a custom range carried to the category page. Charts draw once measured (tests give a width).
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, ScrollView } from 'react-native';
jest.setTimeout(30000);
// Only the clock's date is faked, so the month under test is October 2026 whenever this runs.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 20, 12),
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'queueMicrotask',
      'performance',
      'hrtime',
    ],
  });
});
afterAll(() => {
  jest.useRealTimers();
});
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
const mockSearch = { current: {} as Record<string, string> };
let mockReportsFocus: () => void;
jest.mock('expo-router', () => ({
  router: { setParams: jest.fn(), push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockSearch.current,
  useFocusEffect: (cb: () => void) => {
    mockReportsFocus = cb;
    require('react').useEffect(cb, [cb]);
  },
}));
// Sheets render their content only while open; the real one needs the keyboard controller's native module.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({
    visible,
    title,
    subtitle,
    onClose,
    children,
    footer,
  }: {
    visible: boolean;
    title?: string;
    subtitle?: string;
    onClose: () => void;
    children: unknown;
    footer?: unknown;
  }) =>
    visible
      ? require('react').createElement(
          require('react').Fragment,
          null,
          require('react').createElement(require('react-native').Text, null, title),
          require('react').createElement(require('react-native').Text, null, subtitle),
          require('react').createElement(require('react-native').Pressable, {
            accessibilityLabel: 'Close',
            onPress: onClose,
          }),
          children,
          footer
        )
      : null,
}));
jest.mock('@/db/budgets', () => ({ listBudgetsForMonth: async () => [] }));
jest.mock('@/db/tidyUp', () => ({
  findStartingBalances: async () => [{ categoryName: 'Previous' }],
}));
// Count-up and bar-fill animations would keep ticking past the test's end.
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
jest.mock('@/components/GrowFill', () => ({ GrowFill: () => null }));
// Bars and lines show their settled value: the faked clock never advances, so a running Animated never ends.
jest.mock('@/lib/useGrowFrom', () => ({
  useGrowFrom: (_key: string, target: number) => new (require('react-native').Animated.Value)(target),
  resetGrowMemory: () => {},
}));
const mockDaily = jest.fn(async (..._args: unknown[]) => [
  { date: '2026-10-02', totalMinor: 100000 },
  { date: '2026-10-05', totalMinor: 620000 },
  { date: '2026-10-06', totalMinor: 90000 },
  { date: '2026-10-12', totalMinor: 150000 },
  // Dated after "today" (Oct 20): in the total, but not a day spent so far.
  { date: '2026-10-28', totalMinor: 50000 },
]);
const mockHide = { current: false };
jest.mock('@/theme/PrivacyContext', () => ({
  ...jest.requireActual('@/theme/PrivacyContext'),
  usePrivacy: () => ({ hideAmounts: mockHide.current }),
}));
const bigEntry = (id: string, date: string, amountMinor: number, note: string, categoryId: string) => ({
  id,
  date,
  amountMinor,
  note,
  categoryId,
});
const mockLargest = jest.fn(async (..._args: unknown[]) => [
  bigEntry('b1', '2026-10-05', 620000, 'Weekly groceries', 'food'),
  bigEntry('b2', '2026-10-01', 1800000, '', 'rent'),
  bigEntry('b3', '2026-10-12', 150000, 'New shoes', 'food'),
]);
const mockAccounts = jest.fn(async (..._args: unknown[]) => [
  {
    accountId: 'acc1',
    name: 'Everyday account',
    type: 'bank',
    totalMinor: 1800000,
    topCategories: [cat('rent', 'Rent', 1800000)],
  },
  {
    accountId: 'acc2',
    name: 'Credit card',
    type: 'credit_card',
    totalMinor: 620000,
    topCategories: [cat('food', 'Food', 620000)],
  },
]);
const mockSubs = jest.fn(async (..._args: unknown[]) => [] as ReturnType<typeof cat>[]);
const cat = (categoryId: string, name: string, totalMinor: number) => ({
  categoryId,
  name,
  color: '#8FCBFF',
  totalMinor,
  hasSubcategories: false,
  isSensitive: false,
});
const mockCashFlow = jest.fn(async (..._args: unknown[]) =>
  ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((label, i) => ({
    label,
    incomeMinor: 8000000,
    expenseMinor: i === 6 ? 2500000 : 5000000,
  }))
);
const mockTracks = jest.fn(async (..._args: unknown[]) => [
  {
    categoryId: 'food',
    name: 'Food',
    color: '#8FE8C8',
    totalsMinor: [400000, 420000, 410000, 430000, 400000, 410000, 620000],
  },
]);
const summary = (breakdown: ReturnType<typeof cat>[], income: ReturnType<typeof cat>[] = []) => ({
  incomeMinor: income.reduce((s, c) => s + c.totalMinor, 0),
  expenseMinor: breakdown.reduce((s, c) => s + c.totalMinor, 0),
  netMinor: 0,
  savingsContributionMinor: 0,
  categoryBreakdown: breakdown,
  incomeBreakdown: income,
});
// A period with money in and nothing spent.
const mockIncomeOnly = { current: false };
jest.mock('@/db/reports', () => ({
  ...jest.requireActual('@/db/reports'),
  getRangeComparison: jest.fn(async () => ({
    period: 'month',
    current: summary(
      mockIncomeOnly.current ? [] : [cat('rent', 'Rent', 1800000), cat('food', 'Food', 620000)],
      [cat('prev', 'Previous', 9200000), cat('salary', 'Salary', 7500000)]
    ),
    previous: summary([cat('rent', 'Rent', 1800000), cat('food', 'Food', 410000)]),
    incomeChangePct: null,
    expenseChangePct: null,
  })),
  getMonthlyExpenseTrend: async () =>
    ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((label) => ({ label, totalMinor: 2200000 })),
  getNetWorthTrend: async () =>
    ['Jul', 'Aug', 'Sep'].map((label, i) => ({ label, netWorthMinor: 10000000 + i * 500000 })),
  getMonthlyCashFlow: (...args: unknown[]) => mockCashFlow(...args),
  getCategoryMonthlyTotals: (...args: unknown[]) => mockTracks(...args),
  getDailyExpenseTotals: (...args: unknown[]) => mockDaily(...args),
  getSubcategoryBreakdown: (...args: unknown[]) => mockSubs(...args),
  getLargestExpenses: (...args: unknown[]) => mockLargest(...args),
  getAccountBreakdown: (...args: unknown[]) => mockAccounts(...args),
}));
const mockListTransactions = jest.fn(async () => [
  {
    id: 't1',
    type: 'expense',
    amountMinor: 620000,
    date: '2026-10-05',
    note: 'Groceries',
    categoryId: 'food',
  },
]);
jest.mock('@/db/ledger', () => ({
  listTransactions: (...args: unknown[]) => mockListTransactions(...(args as [])),
  listCategories: async () => [
    {
      id: 'rent',
      name: 'Rent',
      kind: 'expense',
      parentId: null,
      icon: 'home',
      color: '#8FCBFF',
      archived: false,
      sortOrder: 0,
      isSensitive: false,
      isSystem: false,
    },
    {
      id: 'food',
      name: 'Food',
      kind: 'expense',
      parentId: null,
      icon: 'coffee',
      color: '#8FCBFF',
      archived: false,
      sortOrder: 1,
      isSensitive: false,
      isSystem: false,
    },
  ],
  listAccounts: async () => [],
}));
import ReportsScreen from '../../../app/(tabs)/reports';
import { getRangeComparison } from '@/db/reports';
// Date is frozen but animation timers are real. Unmount every screen before restoring the clock,
// otherwise unfinished animations can keep scheduling frames against a future start time.
const mountedScreens = new Set<ReactTestRenderer>();
afterEach(() => {
  act(() => {
    for (const screen of mountedScreens) screen.unmount();
  });
  mountedScreens.clear();
});
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ReportsScreen />);
    mountedScreens.add(tree);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree;
}
it('keeps the report scroll view mounted during a same-period refresh and refresh failure', async () => {
  const tree = await render();
  // Let every load the mount starts finish first, so none can land after the refresh and hide its failure.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  const scroll = tree.root.findAllByType(ScrollView).find((node) => node.props.testID === 'reports-content');
  expect(scroll).toBeDefined();
  let rejectRefresh!: (error: Error) => void;
  jest.mocked(getRangeComparison).mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectRefresh = reject;
      })
  );
  await act(async () => {
    mockReportsFocus();
  });
  expect(tree.root.findAllByType(ScrollView).find((node) => node.props.testID === 'reports-content')).toBe(
    scroll
  );
  await act(async () => {
    rejectRefresh(new Error('refresh interrupted'));
  });
  // The failure is shown a few promise hops later; give a slow runner time for them.
  for (let i = 0; i < 20 && !texts(tree).includes('Couldn’t refresh your report'); i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  expect(tree.root.findAllByType(ScrollView).find((node) => node.props.testID === 'reports-content')).toBe(
    scroll
  );
  expect(texts(tree)).toContain('Couldn’t refresh your report');
  act(() => tree.unmount());
});
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
// A tapped day's entries are read a moment after the finger settles.
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
};
// A slow runner can take longer than `settle`: wait until the screen shows the text, for up to two seconds.
const waitForText = async (tree: ReactTestRenderer, text: string) => {
  for (let i = 0; i < 40 && !texts(tree).includes(text); i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
};
/** Month / Year / Custom sit in the period button's menu: open it, then pick. */
const pickPeriodType = async (tree: ReactTestRenderer, label: string) => {
  await pressText(tree, 'Month');
  await pressText(tree, label);
};
const lastPush = () => (require('expo-router').router.push as jest.Mock).mock.calls.at(-1)[0];
// The story cards and chart draw once they have a width; the renderer never lays anything out.
const layOut = async (tree: ReactTestRenderer) => {
  await act(async () => {
    tree.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.onLayout === 'function')
      .forEach((n) => n.props.onLayout({ nativeEvent: { layout: { width: 320, height: 200 } } }));
  });
};
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label);
// Loads React Native's lazily-required components once, with a generous budget.
beforeAll(async () => {
  await render();
}, 180000);
describe('Reports screen', () => {
  beforeEach(() => {
    mockDaily.mockClear();
    mockSubs.mockClear();
    mockListTransactions.mockClear();
    mockLargest.mockClear();
    mockAccounts.mockClear();
    (require('expo-router').router.push as jest.Mock).mockClear();
    (require('expo-router').router.navigate as jest.Mock).mockClear();
  });
  it('opens directly on Days with the period total, not Home’s full summary', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(expect.arrayContaining(['Overview', 'Breakdown', 'Trends', 'Spending by day']));
    // One compact card with the period's total (Reports can look at any period, unlike Home).
    expect(shown.some((t) => t.startsWith('Spent in '))).toBe(true);
    expect(shown).not.toContain('Usual month');
    // The period in a few short reads, as rows.
    expect(shown).toContain('Worth a look');
    expect(shown).not.toContain('Where it went');
  });
  it('shows a failed day read and retries instead of presenting an empty day', async () => {
    const tree = await render();
    mockListTransactions.mockRejectedValueOnce(new Error('Read interrupted'));
    await pressText(tree, '5');
    await settle();
    await pressText(tree, 'Open day');
    await waitForText(tree, 'Couldn’t load this day');
    expect(texts(tree)).toContain('Couldn’t load this day');
    expect(texts(tree)).not.toContain('Nothing on this day.');
    await pressText(tree, 'Retry day');
    await waitForText(tree, 'Groceries');
    expect(texts(tree)).toContain('Groceries');
    expect(texts(tree)).not.toContain('Couldn’t load this day');
  });
  it('hides the previous report while stepping periods and ignores an older response', async () => {
    const tree = await render();
    await pressText(tree, 'Breakdown');
    expect(texts(tree)).toContain('Food');
    const read = require('@/db/reports').getRangeComparison as jest.Mock;
    const cmp = await read.mock.results.at(-1)!.value;
    let finish!: (value: typeof cmp) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await act(async () => byLabel(tree, 'Previous period').props.onPress());
    expect(texts(tree)).not.toContain('Food');
    read.mockResolvedValueOnce({ ...cmp, current: summary([cat('latest', 'Latest period', 12345)]) });
    await act(async () => byLabel(tree, 'Previous period').props.onPress());
    expect(texts(tree)).toContain('Latest period');
    await act(async () => finish({ ...cmp, current: summary([cat('older', 'Outdated response', 77777)]) }));
    expect(texts(tree)).toContain('Latest period');
    expect(texts(tree)).not.toContain('Outdated response');
  });
  it('does not reopen a day after its pending request finishes', async () => {
    const tree = await render();
    let finish!: (items: Awaited<ReturnType<typeof mockListTransactions>>) => void;
    mockListTransactions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await pressText(tree, '5');
    await settle();
    await pressText(tree, 'Open day');
    await act(async () => byLabel(tree, 'Close').props.onPress());
    await act(async () =>
      finish([
        {
          id: 'late',
          type: 'expense',
          amountMinor: 100,
          date: '2026-10-05',
          note: 'Late entry',
          categoryId: 'food',
        },
      ])
    );
    expect(texts(tree)).not.toContain('Late entry');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Close')).toHaveLength(0);
  });
  it('reports account-query failures and recovers through retry', async () => {
    const tree = await render();
    mockAccounts.mockRejectedValueOnce(new Error('Account read interrupted'));
    await pressText(tree, 'Breakdown');
    await pressText(tree, 'By category');
    await pressText(tree, 'By account');
    expect(texts(tree)).toContain('Some report details couldn’t load');
    await pressText(tree, 'Retry details');
    expect(texts(tree)).not.toContain('Some report details couldn’t load');
    expect(texts(tree)).toContain('Everyday account');
  });
  it('switches lens: Categories shows where it went, Trends the chart', async () => {
    const tree = await render();
    await pressText(tree, 'Breakdown');
    let shown = texts(tree);
    expect(shown).toEqual(expect.arrayContaining(['Where it went', 'Spending', 'Income', 'Rent', 'Food']));
    expect(shown).not.toContain('Spending by day');
    await pressText(tree, 'Trends');
    await layOut(tree);
    shown = texts(tree);
    expect(shown).toContain('Net worth');
    expect(shown).not.toContain('Money in and out');
    await pressText(tree, 'Cash flow');
    await layOut(tree);
    expect(texts(tree)).toContain('Money in and out');
    expect(tree.root.findAllByType(require('./TrendChart').TrendChart)).toHaveLength(0);
    await pressText(tree, 'Net worth');
    await layOut(tree);
    expect(tree.root.findAllByType(require('./CashFlowCard').CashFlowCard)).toHaveLength(0);
    expect(tree.root.findByType(require('./TrendChart').TrendChart).props.fixedKind).toBe('netWorth');
    expect(shown).toContain('Against your usual');
    expect(shown).not.toContain('Where it went');
    await pressText(tree, 'Overview');
    expect(texts(tree)).toContain('Spending by day');
  });
  it('scales category bars to their share of all spending', async () => {
    const tree = await render();
    await pressText(tree, 'Breakdown');
    const Fill = require('@/components/GrowFill').GrowFill;
    const bars = tree.root.findAllByType(Fill).map((n) => n.props.pct as number);
    expect(bars[0]).toBeCloseTo((1800000 / 2420000) * 100);
    expect(bars[1]).toBeCloseTo((620000 / 2420000) * 100);
    expect(bars.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100);
  });
  it('shows the insight rows, and keeps the header outside report scrolling', async () => {
    const tree = await render();
    const scroll = tree.root.findAllByType(ScrollView).find((n) => n.props.testID === 'reports-content')!;
    expect(scroll.props.stickyHeaderIndices).toBeUndefined();
    expect(scroll.findAllByType(Text).map((n) => n.props.children)).not.toContain('Reports');
    expect(texts(tree)).toContain('Heaviest day');
  });
  it('Trends asks for the in-and-out and category tracks with savings left out while hidden', async () => {
    mockHide.current = true;
    const accountRead = jest
      .spyOn(require('@/db/ledger'), 'listAccounts')
      .mockResolvedValue([{ id: 'private', type: 'savings' }]);
    try {
      const tree = await render();
      await pressText(tree, 'Trends');
      await layOut(tree);
      expect(mockCashFlow).toHaveBeenLastCalledWith(7, expect.any(Date), true);
      expect(texts(tree)).not.toContain('Net worth');
      expect(mockTracks).toHaveBeenLastCalledWith(7, expect.any(Date), true);
    } finally {
      accountRead.mockRestore();
      mockHide.current = false;
    }
  });
  it('opens a heatmap day in a sheet with a fixed header, and closes it', async () => {
    const tree = await render();
    await pressText(tree, '5');
    await settle();
    expect(mockListTransactions).toHaveBeenCalledWith({
      fromDate: '2026-10-05',
      toDate: '2026-10-05',
      currency: 'INR',
    });
    // Tapping only inspects the day; its entries open from the inspector.
    expect(texts(tree)).not.toContain('Groceries');
    await pressText(tree, 'Open day');
    let shown = texts(tree);
    expect(shown).toContain('Groceries');
    expect(shown).toContain('1 transaction');
    await act(async () => {
      byLabel(tree, 'Close').props.onPress();
    });
    shown = texts(tree);
    expect(shown).not.toContain('Groceries');
  });
  it('inspects a tapped day under the grid: its amount, usual-day comparison and what it was made of', async () => {
    const tree = await render();
    await pressText(tree, '5');
    await settle();
    const shown = texts(tree);
    expect(shown).toContain('Mon, 5 Oct');
    expect(shown.some((t) => t.endsWith('× your usual day'))).toBe(true);
    expect(shown.some((t) => t.startsWith('Food '))).toBe(true);
  });
  it('keeps the first card to the figure, pace, income and what was kept: no chart', async () => {
    const tree = await render();
    const shown = texts(tree);
    expect(shown).toEqual(expect.arrayContaining(['Income', 'Kept']));
    expect(tree.root.findAll((n) => n.props.accessibilityRole === 'adjustable')).toHaveLength(0);
  });
  it('the heaviest-day story opens that day on the heatmap', async () => {
    const tree = await render();
    const card = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Heaviest day')
    );
    await act(async () => {
      card.props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await settle();
    expect(mockListTransactions).toHaveBeenCalledWith({
      fromDate: '2026-10-05',
      toDate: '2026-10-05',
      currency: 'INR',
    });
    expect(texts(await Promise.resolve(tree))).toContain('Groceries');
  });
  it('a category story switches to Categories with that row picked', async () => {
    const tree = await render();
    const card = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('What moved')
    );
    await act(async () => {
      card.props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const shown = texts(tree);
    expect(shown).toContain('Where it went');
    expect(shown).toContain('Open Food ›');
  });
  it('a category row picks itself and links to its own page, on the same period', async () => {
    const tree = await render();
    await pressText(tree, 'Breakdown');
    expect(texts(tree)).not.toContain('Open Food ›');
    await pressText(tree, 'Food');
    expect(texts(tree)).toContain('Open Food ›');
    await pressText(tree, 'Open Food ›');
    expect(lastPush()).toBe('/category/food?g=month&o=0');
  });
  const scopeLabel = (tree: ReactTestRenderer) =>
    tree.root.find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Colour the heatmap by category:') &&
        typeof n.props.onPress === 'function'
    ).props.accessibilityLabel as string;
  it('"See its days on the heatmap" narrows the heatmap to that category, and the dropdown clears it', async () => {
    const tree = await render();
    await pressText(tree, 'Breakdown');
    await pressText(tree, 'Food');
    await pressText(tree, 'See its days on the heatmap →');
    expect(texts(tree)).toContain('Spending by day');
    expect(mockDaily.mock.calls.some((c) => c[2] === 'food')).toBe(true);
    expect(scopeLabel(tree)).toContain('Food');
    await act(async () => {
      tree.root
        .find(
          (n) => n.props.accessibilityLabel?.startsWith('Colour the heatmap by category:') && n.props.onPress
        )
        .props.onPress();
    });
    await pressText(tree, 'All spending');
    expect(scopeLabel(tree)).toContain('All spending');
  });
  it('a new period forgets the open day and the filter', async () => {
    const tree = await render();
    await pressText(tree, 'Breakdown');
    await pressText(tree, 'Food');
    await pressText(tree, 'See its days on the heatmap →');
    expect(scopeLabel(tree)).toContain('Food');
    await act(async () => {
      byLabel(tree, 'Previous period').props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(scopeLabel(tree)).toContain('All spending');
  });
  it('switches to where the money came from, and points starting balances at Tidy up', async () => {
    const tree = await render();
    await pressText(tree, 'Breakdown');
    await pressText(tree, 'Income');
    const shown = texts(tree);
    expect(shown).toEqual(expect.arrayContaining(['Where it came from', 'Previous', 'Salary']));
    expect(shown).not.toContain('Where it went');
    expect(shown.some((t) => t.startsWith('Previous is over half of this income'))).toBe(true);
    // Income has no days on the heatmap, so no link to them.
    await pressText(tree, 'Salary');
    expect(texts(tree)).not.toContain('See its days on the heatmap →');
    await pressText(tree, 'Tidy up');
    expect(require('expo-router').router.push).toHaveBeenCalledWith('/tidy-up');
  });
  it('shows a custom range and carries it to the category page', async () => {
    const tree = await render();
    await pickPeriodType(tree, 'Custom range');
    expect(texts(tree)).toContain('Pick a range');
    await pressText(tree, 'Last 30 days');
    const show = texts(tree).find((t) => t.startsWith('Show '))!;
    await pressText(tree, show);
    expect(texts(tree)).not.toContain('Pick a range');
    await pressText(tree, 'Breakdown');
    await pressText(tree, 'Food');
    await pressText(tree, 'Open Food ›');
    expect(lastPush()).toMatch(/^\/category\/food\?g=custom&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
  });
  it("opens on a week from a link, as the week Wrap's report button sends", async () => {
    mockSearch.current = { from: '2026-09-20', to: '2026-09-26' };
    try {
      const tree = await render();
      await pressText(tree, 'Breakdown');
      await pressText(tree, 'Food');
      await pressText(tree, 'Open Food ›');
      expect(lastPush()).toBe('/category/food?g=custom&from=2026-09-20&to=2026-09-26');
    } finally {
      mockSearch.current = {};
    }
  });
  it.each(['yesterday', '2026-02-29', '2026-02-31', '2026-00-01'])(
    'ignores a malformed range link (%s)',
    async (from) => {
      mockSearch.current = { from, to: '2026-09-26' };
      try {
        const tree = await render();
        await pressText(tree, 'Breakdown');
        await pressText(tree, 'Food');
        await pressText(tree, 'Open Food ›');
        expect(lastPush()).toBe('/category/food?g=month&o=0');
      } finally {
        mockSearch.current = {};
      }
    }
  );
  describe('Biggest spends', () => {
    it('previews three purchases and expands the remaining largest entries', async () => {
      const original = mockLargest.getMockImplementation()!;
      mockLargest.mockImplementation(async () =>
        Array.from({ length: 5 }, (_, i) =>
          bigEntry(`extra${i}`, '2026-10-05', 50000 - i * 1000, `Purchase ${i}`, 'food')
        )
      );
      let tree!: ReactTestRenderer;
      try {
        tree = await render();
        expect(texts(tree)).toContain('Purchase 2');
        expect(texts(tree)).not.toContain('Purchase 4');
        await act(async () => byLabel(tree, 'View all biggest purchases').props.onPress());
        expect(texts(tree)).toContain('Purchase 4');
        await act(async () => byLabel(tree, 'Show fewer biggest purchases').props.onPress());
        expect(texts(tree)).not.toContain('Purchase 4');
      } finally {
        if (tree) act(() => tree.unmount());
        mockLargest.mockImplementation(original);
      }
    });

    it("lists the period's largest single expenses, up to today, and opens one's day", async () => {
      const tree = await render();
      expect(mockLargest).toHaveBeenCalledWith(
        { start: '2026-10-01', end: '2026-10-20' },
        5,
        false,
        undefined
      );
      const shown = texts(tree);
      expect(shown).toEqual(expect.arrayContaining(['Biggest spends', 'Top 3', 'Weekly groceries', 'Rent']));
      await act(async () => {
        byLabel(tree, 'Weekly groceries, Mon, 5 Oct. Show this day').props.onPress();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      await settle();
      expect(mockListTransactions).toHaveBeenCalledWith({
        fromDate: '2026-10-05',
        toDate: '2026-10-05',
        currency: 'INR',
      });
      expect(texts(tree)).toContain('1 transaction');
    });
    it('is left out when there are fewer than three entries', async () => {
      const original = mockLargest.getMockImplementation()!;
      mockLargest.mockImplementation(async () => [bigEntry('b1', '2026-10-05', 620000, 'Groceries', 'food')]);
      try {
        expect(texts(await render())).not.toContain('Biggest spends');
      } finally {
        mockLargest.mockImplementation(original);
      }
    });
    it('follows the category the heatmap is narrowed to', async () => {
      const tree = await render();
      await pressText(tree, 'Breakdown');
      await pressText(tree, 'Food');
      await pressText(tree, 'See its days on the heatmap →');
      expect(mockLargest).toHaveBeenCalledWith({ start: '2026-10-01', end: '2026-10-20' }, 5, false, 'food');
    });
    it('is not shown for a year, which has no days to open', async () => {
      const tree = await render();
      await pickPeriodType(tree, 'Year');
      expect(texts(tree)).not.toContain('Biggest spends');
      expect(texts(tree)).not.toContain('Weekday rhythm');
    });
  });
  describe('By account', () => {
    it('groups where it went by account; an account opens its top categories and Activity on the month', async () => {
      const tree = await render();
      await pressText(tree, 'Breakdown');
      expect(texts(tree)).toContain('By category');
      await pressText(tree, 'By category');
      await pressText(tree, 'By account');
      expect(mockAccounts).toHaveBeenCalledWith({ start: '2026-10-01', end: '2026-10-31' }, 'expense', false);
      expect(texts(tree)).toEqual(expect.arrayContaining(['Everyday account', 'Credit card']));
      await pressText(tree, 'Credit card');
      expect(texts(tree)).toEqual(expect.arrayContaining(['Top categories', 'Food', 'Open Credit card ›']));
      expect(texts(tree)).not.toContain('See its days on the heatmap →');
      await pressText(tree, 'Open Credit card ›');
      expect(require('expo-router').router.navigate).toHaveBeenCalledWith(
        '/transactions?account=acc2&month=2026-10'
      );
    });
    it('goes back to categories, and the income side groups by account too', async () => {
      const tree = await render();
      await pressText(tree, 'Breakdown');
      await pressText(tree, 'By category');
      await pressText(tree, 'By account');
      await pressText(tree, 'Income');
      expect(mockAccounts).toHaveBeenCalledWith({ start: '2026-10-01', end: '2026-10-31' }, 'income', false);
      await pressText(tree, 'By account');
      await pressText(tree, 'By category');
      expect(texts(tree)).toEqual(expect.arrayContaining(['Where it came from', 'Salary']));
    });
    it('has no Activity link outside a single month', async () => {
      const tree = await render();
      await pickPeriodType(tree, 'Year');
      await pressText(tree, 'Breakdown');
      await pressText(tree, 'By category');
      await pressText(tree, 'By account');
      await pressText(tree, 'Credit card');
      expect(texts(tree)).toContain('Top categories');
      expect(texts(tree)).not.toContain('Open Credit card ›');
    });
  });
  describe('a period with income but no spending', () => {
    afterEach(() => {
      mockIncomeOnly.current = false;
    });
    it('still shows the lenses and the income breakdown', async () => {
      mockIncomeOnly.current = true;
      const tree = await render();
      expect(texts(tree)).toEqual(expect.arrayContaining(['Overview', 'Breakdown', 'Trends']));
      await pressText(tree, 'Breakdown');
      await pressText(tree, 'Income');
      expect(texts(tree)).toEqual(expect.arrayContaining(['Where it came from', 'Salary']));
    });
    it('says there is no spending, not no income, on the Spending side', async () => {
      mockIncomeOnly.current = true;
      const tree = await render();
      await pressText(tree, 'Breakdown');
      expect(texts(tree).some((t) => t.startsWith('No spending in '))).toBe(true);
    });
  });
  describe('with savings & investment amounts hidden', () => {
    afterEach(() => {
      mockHide.current = false;
    });
    it('asks for the biggest spends and the accounts without the sensitive categories', async () => {
      mockHide.current = true;
      const tree = await render();
      expect(mockLargest).toHaveBeenCalledWith(
        { start: '2026-10-01', end: '2026-10-20' },
        5,
        true,
        undefined
      );
      await pressText(tree, 'Breakdown');
      await pressText(tree, 'By category');
      await pressText(tree, 'By account');
      expect(mockAccounts).toHaveBeenCalledWith({ start: '2026-10-01', end: '2026-10-31' }, 'expense', true);
    });
  });
});
