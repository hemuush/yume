/**
 * Reports assembled: three lenses (Days heatmap + story cards, Categories, Trends), the
 * Income switch, and a custom range carried to the category page. Charts draw once measured (tests give a width).
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

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
jest.mock('expo-router', () => ({
  router: { setParams: jest.fn(), push: jest.fn(), navigate: jest.fn() },
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
  findStartingBalances: async () => [{ categoryName: 'Previous' }],
}));
// Count-up and bar-fill animations would keep ticking past the test's end.
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
jest.mock('@/features/reports/AnimatedCategoryFill', () => ({ AnimatedCategoryFill: () => null }));
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
  getRangeComparison: async () => ({
    period: 'month',
    current: summary(
      mockIncomeOnly.current ? [] : [cat('rent', 'Rent', 1800000), cat('food', 'Food', 620000)],
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

  it('opens on the period at a glance, then the three lenses, starting on Days', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining(['Days', 'Categories', 'Trends', 'Tap a day to see what went out'])
    );
    // The summary card: spent, the usual month (₹22,000 from the trend), the change on the month before
    // (₹22,100 then), and money in · spent · kept.
    expect(shown.some((t) => t.startsWith('Spent in '))).toBe(true);
    expect(shown).toEqual(
      expect.arrayContaining(['Usual month', '₹22,000', 'Money in', '₹1,67,000', 'Kept', '₹1,42,800'])
    );
    expect(shown.some((t) => t.startsWith('₹2,100 more than'))).toBe(true);
    expect(shown.indexOf('Kept')).toBeLessThan(shown.indexOf('Days'));
    expect(shown.some((t) => t.endsWith(', in short'))).toBe(true);
    expect(shown).not.toContain('Where it went');
  });

  it('switches lens: Categories shows where it went, Trends the chart', async () => {
    const tree = await render();
    await pressText(tree, 'Categories');
    let shown = texts(tree);
    expect(shown).toEqual(expect.arrayContaining(['Where it went', 'Spending', 'Income', 'Rent', 'Food']));
    expect(shown).not.toContain('Tap a day to see what went out');
    await pressText(tree, 'Trends');
    await layOut(tree);
    shown = texts(tree);
    expect(shown).toContain('Net worth');
    expect(shown).toContain('Money in and out');
    expect(shown).toContain('Against your usual');
    expect(shown).not.toContain('Where it went');
    await pressText(tree, 'Days');
    expect(texts(tree)).toContain('Tap a day to see what went out');
  });

  it('Trends asks for the in-and-out and category tracks with savings left out while hidden', async () => {
    mockHide.current = true;
    try {
      const tree = await render();
      await pressText(tree, 'Trends');
      await layOut(tree);
      expect(mockCashFlow).toHaveBeenLastCalledWith(7, expect.any(Date), true);
      expect(mockTracks).toHaveBeenLastCalledWith(7, expect.any(Date), true);
    } finally {
      mockHide.current = false;
    }
  });

  it('opens a heatmap day as a card under the grid, and closes it', async () => {
    const tree = await render();
    await pressText(tree, '5');
    expect(mockListTransactions).toHaveBeenCalledWith({ fromDate: '2026-10-05', toDate: '2026-10-05' });
    let shown = texts(tree);
    expect(shown).toContain('Groceries');
    expect(shown).toContain('1 transaction');
    await act(async () => {
      byLabel(tree, 'Close this day').props.onPress();
    });
    shown = texts(tree);
    expect(shown).not.toContain('Groceries');
  });

  it('tapping the open day again puts it away', async () => {
    const tree = await render();
    await pressText(tree, '5');
    expect(texts(tree)).toContain('Groceries');
    await pressText(tree, '5');
    expect(texts(tree)).not.toContain('Groceries');
  });

  it('the heaviest-day story opens that day on the heatmap', async () => {
    const tree = await render();
    await layOut(tree);
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
    expect(mockListTransactions).toHaveBeenCalledWith({ fromDate: '2026-10-05', toDate: '2026-10-05' });
    expect(texts(await Promise.resolve(tree))).toContain('Groceries');
  });

  it('a category story switches to Categories with that row picked', async () => {
    const tree = await render();
    await layOut(tree);
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
    await pressText(tree, 'Categories');
    expect(texts(tree)).not.toContain('Open Food ›');
    await pressText(tree, 'Food');
    expect(texts(tree)).toContain('Open Food ›');
    await pressText(tree, 'Open Food ›');
    expect(lastPush()).toBe('/category/food?g=month&o=0');
  });

  it('"See its days on the heatmap" narrows the heatmap to that category, and the chip clears it', async () => {
    const tree = await render();
    await pressText(tree, 'Categories');
    await pressText(tree, 'Food');
    await pressText(tree, 'See its days on the heatmap →');
    expect(texts(tree)).toContain('Tap a day to see what went out');
    expect(mockDaily.mock.calls.some((c) => c[2] === 'food')).toBe(true);
    await act(async () => {
      byLabel(tree, 'Clear the Food filter').props.onPress();
    });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Clear the Food filter')).toHaveLength(0);
  });

  it('a new period forgets the open day and the filter', async () => {
    const tree = await render();
    await pressText(tree, 'Categories');
    await pressText(tree, 'Food');
    await pressText(tree, 'See its days on the heatmap →');
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === 'Clear the Food filter').length
    ).toBeGreaterThan(0);
    await act(async () => {
      byLabel(tree, 'Previous period').props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Clear the Food filter')).toHaveLength(0);
  });

  it('switches to where the money came from, and points starting balances at Tidy up', async () => {
    const tree = await render();
    await pressText(tree, 'Categories');
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
    await pressText(tree, 'Categories');
    await pressText(tree, 'Food');
    await pressText(tree, 'Open Food ›');
    expect(lastPush()).toMatch(/^\/category\/food\?g=custom&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
  });

  it("opens on a week from a link, as the week Wrap's report button sends", async () => {
    mockSearch.current = { from: '2026-09-20', to: '2026-09-26' };
    try {
      const tree = await render();
      await pressText(tree, 'Categories');
      await pressText(tree, 'Food');
      await pressText(tree, 'Open Food ›');
      expect(lastPush()).toBe('/category/food?g=custom&from=2026-09-20&to=2026-09-26');
    } finally {
      mockSearch.current = {};
    }
  });

  it('ignores a malformed range link', async () => {
    mockSearch.current = { from: 'yesterday', to: '2026-09-26' };
    try {
      const tree = await render();
      await pressText(tree, 'Categories');
      await pressText(tree, 'Food');
      await pressText(tree, 'Open Food ›');
      expect(lastPush()).toBe('/category/food?g=month&o=0');
    } finally {
      mockSearch.current = {};
    }
  });

  describe('Weekday rhythm', () => {
    it('shows seven bars with the busiest weekday read out, and a tapped bar reads its own line', async () => {
      const tree = await render();
      const shown = texts(tree);
      expect(shown).toContain('Weekday rhythm');
      expect(shown.some((t) => t.startsWith('Mondays run highest: '))).toBe(true);
      await act(async () => {
        tree.root
          .find((n) => typeof n.props.onPress === 'function' && /^Tuesday, /.test(n.props.accessibilityLabel))
          .props.onPress();
      });
      expect(texts(tree).some((t) => t.startsWith('Tuesday: ') && t.includes('a day over 3 Tuesdays'))).toBe(
        true
      );
    });

    it('says so on a month too young to have a pattern', async () => {
      jest.setSystemTime(new Date(2026, 9, 5, 12));
      try {
        const shown = texts(await render());
        expect(shown).toContain('Weekday rhythm');
        expect(shown.some((t) => t.startsWith('Needs about 2 weeks of entries'))).toBe(true);
        expect(shown.some((t) => t.startsWith('Mondays run highest'))).toBe(false);
      } finally {
        jest.setSystemTime(new Date(2026, 9, 20, 12));
      }
    });
  });

  describe('Biggest spends', () => {
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
      expect(mockListTransactions).toHaveBeenCalledWith({ fromDate: '2026-10-05', toDate: '2026-10-05' });
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
      await pressText(tree, 'Categories');
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
      await pressText(tree, 'Categories');
      expect(texts(tree)).toContain('By category');
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
      await pressText(tree, 'Categories');
      await pressText(tree, 'By account');
      await pressText(tree, 'Income');
      expect(mockAccounts).toHaveBeenCalledWith({ start: '2026-10-01', end: '2026-10-31' }, 'income', false);
      await pressText(tree, 'By category');
      expect(texts(tree)).toEqual(expect.arrayContaining(['Where it came from', 'Salary']));
    });

    it('has no Activity link outside a single month', async () => {
      const tree = await render();
      await pickPeriodType(tree, 'Year');
      await pressText(tree, 'Categories');
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
      expect(texts(tree)).toEqual(expect.arrayContaining(['Days', 'Categories', 'Trends']));
      await pressText(tree, 'Categories');
      await pressText(tree, 'Income');
      expect(texts(tree)).toEqual(expect.arrayContaining(['Where it came from', 'Salary']));
    });

    it('says there is no spending, not no income, on the Spending side', async () => {
      mockIncomeOnly.current = true;
      const tree = await render();
      await pressText(tree, 'Categories');
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
      await pressText(tree, 'Categories');
      await pressText(tree, 'By account');
      expect(mockAccounts).toHaveBeenCalledWith({ start: '2026-10-01', end: '2026-10-31' }, 'expense', true);
    });
  });
});
