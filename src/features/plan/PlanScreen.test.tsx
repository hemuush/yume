/**
 * Renders the Plan tab with fixed data dated from today: tiles show real figures in order and open their
 * screens, Coming up lists 14 days grouped by day with Pay on EMIs. Tile wording is in planOverview.test.ts.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// The first render loads React Native's component tree; on a cold parallel run (CI) that can exceed Jest's
// 5s default, so the timeout is generous.
jest.setTimeout(30000);
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null, HeaderUserButton: () => null }));
/** YYYY-MM-DD, `n` days from today. */
const mockDay = (n: number) => {
  const { addDaysToIsoDate, toLocalIsoDate } = require('@/lib/date');
  return addDaysToIsoDate(toLocalIsoDate(new Date()), n);
};
let mockSection: string | undefined;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({ section: mockSection }),
  // useScreenLoad's focus effect: run once, like a first focus.
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/db/budgets', () => ({
  listBudgetsForMonth: async () => [
    {
      budget: { id: 'b1' },
      categoryName: 'Food',
      spentMinor: 3000000,
      effectiveLimitMinor: 1000000,
      remainingMinor: -2000000,
      percentUsed: 300,
      overBudget: true,
    },
    {
      budget: { id: 'b2' },
      categoryName: 'Fuel',
      spentMinor: 100000,
      effectiveLimitMinor: 400000,
      remainingMinor: 300000,
      percentUsed: 25,
      overBudget: false,
    },
  ],
}));
jest.mock('@/db/savingsGoals', () => ({ listSavingsGoals: async () => [] }));
jest.mock('@/db/recurring', () => ({
  listRecurringRules: async () => [
    {
      id: 'r1',
      type: 'expense',
      active: true,
      nextRunDate: mockDay(1),
      amountMinor: 45000,
      note: 'Streaming',
      categoryId: null,
      accountId: 'a1',
      toAccountId: null,
    },
  ],
}));
jest.mock('@/db/loans', () => ({
  listLoans: async () => [
    {
      id: 'l1',
      counterparty: 'Home loan',
      direction: 'borrowed',
      status: 'active',
      principalMinor: 400000000,
      outstandingPrincipalMinor: 300000000,
    },
  ],
  getLoanProgress: async () => [
    {
      loanId: 'l1',
      paidCount: 12,
      totalCount: 120,
      nextDueDate: mockDay(3),
      nextEmiMinor: 2500000,
      lastDueDate: '2035-06-05',
      pendingInterestMinor: 0,
    },
  ],
  getLoanPaymentContext: async () => ({
    installment: { id: 'p13', installmentNumber: 13, dueDate: mockDay(3), emiAmountMinor: 2500000 },
    account: { id: 'bank', name: 'Bank' },
    categoryId: 'emi',
  }),
}));
const mockPaySheet = { current: null as null | { installment: { id: string } } };
jest.mock('@/features/loans/PayInstallmentSheet', () => ({
  PayInstallmentSheet: (props: { installment: { id: string } }) => {
    mockPaySheet.current = props;
    return null;
  },
}));
jest.mock('@/db/people', () => ({ listPeople: async () => [{ balanceMinor: 50000 }] }));
jest.mock('@/db/ledger', () => ({
  listAccounts: async () => [
    { id: 'pot', name: 'Pot', type: 'savings', archived: false, currentBalanceMinor: 5400000 },
  ],
  listCategories: async () => [
    { id: 'emi', name: 'Loan EMI', isSystem: true },
    { id: 'food', name: 'Food', isSystem: false },
  ],
}));
jest.mock('@/db/reports', () => ({
  getDailyGoalStreakSeries: async () => [0, 1, 2, 3, 4].map((n) => ({ streakDays: n })),
  // Loan EMI is the biggest, but it's a built-in category — What-if skips it.
  getCategoryMonthlyAverages: async () => [
    { categoryId: 'emi', name: 'Loan EMI', totalMinor: 3000000 },
    { categoryId: 'food', name: 'Food', totalMinor: 2000000 },
  ],
}));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getDailySpendingGoal: async () => 500000,
}));

import PlanScreen from '../../../app/(tabs)/plan';
import { router } from 'expo-router';

// Bars and rings animate to their values (useGrowFrom); fake timers keep those
// frames inside the test instead of firing after it ends.
jest.useFakeTimers();

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PlanScreen />);
  });
  await act(async () => {}); // let the load's promises settle
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

// Loads RN's lazily-required components once up front with a generous budget: on a cold parallel run (CI)
// their first load can outlast a test's limit and fail this file intermittently.
beforeAll(async () => {
  await render();
}, 180000);

describe('Plan tab', () => {
  it('shows the tiles in order, then Coming up', async () => {
    const shown = texts(await render());
    const headings = [
      'Next 14 days',
      '2 payments',
      'Where you stand',
      'EMIs',
      'Budgets',
      'Debt-free by ' +
        new Date(2035, 5, 5).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      'Goals',
      'Saving toward',
      'People & habit',
      'Friends',
      'Spend streak',
      'Coming up',
    ];
    // Each heading is looked for after the one before it: "EMIs" also labels the 14-day strip's key.
    const positions: number[] = [];
    for (const h of headings) positions.push(shown.indexOf(h, (positions.at(-1) ?? -1) + 1));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it("shows each tile's own figures", async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        '₹25,450', // ₹25,000 EMI + ₹450 bill in the next 14 days
        '1 over',
        '+₹500',
        '4 days',
        'Start a goal that fills up by itself',
        'Home loan',
        'Streaming',
      ])
    );
    // A savings account a new goal could follow.
    expect(shown.some((t) => t.startsWith('Follow Pot (₹54,000)'))).toBe(true);
    // What-if picks the biggest category a cut could apply to, not the EMI.
    expect(shown.some((t) => t.includes('less on Food?'))).toBe(true);
    expect(shown.some((t) => t.includes('less on Loan EMI'))).toBe(false);
    // 25% of the home loan's principal repaid.
    expect(shown.some((t) => t.includes('25% paid'))).toBe(true);
  });

  it('groups Coming up by day, with each day’s total', async () => {
    const shown = texts(await render());
    const dayLabel = (n: number) =>
      new Date(`${mockDay(n)}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    expect(shown.indexOf(dayLabel(1))).toBeGreaterThan(shown.indexOf('Coming up'));
    expect(shown.indexOf(dayLabel(3))).toBeGreaterThan(shown.indexOf(dayLabel(1)));
    expect(shown).toContain('₹25,000');
  });

  it('says what each tile means in plain words', async () => {
    const shown = texts(await render());
    const ahead = (n: number) =>
      new Date(`${mockDay(n)}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    expect(shown).toContain(`${ahead(3)}, in 3 days · 1 loan`);
    expect(shown).toContain('Food is ₹20,000 over');
    expect(shown).toContain('to collect from 1 person');
  });

  it('opens each tile’s own screen', async () => {
    const tree = await render();
    const byLabel = (start: string) =>
      tree.root.findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith(start) &&
          n.props.onPress
      )[0];
    act(() => byLabel('EMIs').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/loans');
    act(() => byLabel('Budgets,').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/budgets');
    act(() => byLabel('₹30,00,000 of debt left').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/loans');
    act(() => byLabel('Friends & Family').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/people');
    act(() => byLabel('Open savings goals').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/savings-goals');
    act(() => byLabel('Open the what-if sandbox').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/whatif');
    act(() => byLabel('Open Recurring').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/recurring');
    act(() => byLabel('4-day streak').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/garden');
    // The 14-day tile scrolls down to Coming up instead of leaving the tab.
    (router.push as jest.Mock).mockClear();
    act(() => byLabel('₹25,450 due in the next 14 days').props.onPress());
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows a day’s total and items when you tap its bar, and jumps to it in the list', async () => {
    const tree = await render();
    const label = new Date(`${mockDay(3)}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const bar = () =>
      tree.root.find(
        (n) => n.props.accessibilityLabel === `${label}, ₹25,000 due. Show details` && n.props.onPress
      );
    (router.push as jest.Mock).mockClear();
    act(() => bar().props.onPress());
    expect(texts(tree)).toContain('See in list');
    expect(texts(tree).some((t) => t.includes('₹25,000 · Home loan'))).toBe(true);
    // Tapping the bar again hides the caption.
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel === `${label}, ₹25,000 due. Hide details`)
        .props.onPress()
    );
    expect(texts(tree)).not.toContain('See in list');
    act(() => bar().props.onPress());
    act(() =>
      tree.root.find((n) => n.props.accessibilityLabel === `See ${label} in the list`).props.onPress()
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('colours Coming up rows by how soon they are due', async () => {
    const { DateTile } = require('@/components/DateTile');
    const tree = await render();
    // The EMI is 3 days out (amber); the streaming bill tomorrow is not an EMI or card bill.
    const tones = tree.root.findAllByType(DateTile).map((t) => [t.props.urgent, t.props.soon]);
    expect(tones).toEqual([
      [false, false],
      [false, true],
    ]);
  });

  it('marks an EMI paid straight from Coming up', async () => {
    const tree = await render();
    const paid = tree.root.find((n) => n.props.accessibilityLabel === 'Pay Home loan EMI' && n.props.onPress);
    await act(async () => {
      paid.props.onPress();
    });
    expect(mockPaySheet.current?.installment.id).toBe('p13');
  });
  it("lands on Coming up when Home's “+N more” sends you, then forgets it was asked", async () => {
    mockSection = 'coming-up';
    try {
      await render();
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      expect(router.setParams).toHaveBeenCalledWith({ section: undefined });
    } finally {
      mockSection = undefined;
    }
  });
});
