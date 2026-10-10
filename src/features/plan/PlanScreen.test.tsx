/**
 * Renders the Plan tab with fixed data dated from today: the runway, jars, debt path, goals and tiles show
 * real figures in order and open their screens, Coming up lists 14 days grouped by day with Pay on EMIs.
 * Wording rules are in planOverview.test.ts and runway.test.ts.
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
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHideAmounts }) }));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
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
      accountId: 'bank',
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
const mockCards = jest.fn(async () => []);
jest.mock('@/db/cardCycles', () => ({ listCardCycles: () => mockCards() }));
jest.mock('@/db/people', () => ({
  listPeople: async () => [{ id: 'p1', name: 'Ravi', balanceMinor: 50000 }],
}));
/** What the bank account holds — a test lowers it to run the runway short. */
let mockBank = 3000000;
jest.mock('@/db/ledger', () => ({
  listAccounts: async () => [
    {
      id: 'pot',
      name: 'Pot',
      type: 'savings',
      currency: 'INR',
      archived: false,
      currentBalanceMinor: 5400000,
    },
    {
      id: 'bank',
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      archived: false,
      currentBalanceMinor: mockBank,
    },
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
  getDefaultCurrency: async () => 'INR',
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
  const dayLabel = (n: number) =>
    new Date(`${mockDay(n)}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  it('shows the sections in order, then Coming up', async () => {
    const shown = texts(await render());
    const headings = [
      'Next 14 days',
      '2 payments',
      'This month’s budgets',
      'The way to debt-free',
      'Estimated debt-free · ' +
        new Date(2035, 5, 5).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      'Saving toward',
      'People & habit',
      'Friends',
      'Spend streak',
      'Coming up',
    ];
    const positions: number[] = [];
    for (const h of headings) positions.push(shown.indexOf(h, (positions.at(-1) ?? -1) + 1));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it("shows each section's own figures", async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        '₹25,450', // ₹25,000 EMI + ₹450 bill in the next 14 days
        '1 over',
        '₹500',
        '4 days',
        'Start a goal that fills up by itself',
        'Home loan',
        'Streaming',
        '₹25,000 in EMIs over 14 days',
      ])
    );
    // A savings account a new goal could follow.
    expect(shown.some((t) => t.startsWith('Follow Pot (₹54,000)'))).toBe(true);
    // What-if cuts the biggest category it can, not the EMI: 10% of Food's ₹20,000.
    expect(shown).toContain('Food');
    expect(shown).toContain('₹2,000');
    expect(shown.some((t) => t.includes('Loan EMI'))).toBe(false);
    // 25% of the home loan's principal repaid.
    expect(shown.some((t) => t.includes('25% repaid'))).toBe(true);
  });

  it('says whether your accounts cover what’s due, and when they run short', async () => {
    expect(texts(await render())).toContain('Your accounts cover it');
    mockBank = 1000000;
    try {
      const shown = texts(await render());
      expect(shown).not.toContain('Your accounts cover it');
      const short = new Date(`${mockDay(3)}T00:00:00`).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      });
      expect(shown.some((t) => t.startsWith('Short ₹15,450 on') && t.includes(short))).toBe(true);
    } finally {
      mockBank = 3000000;
    }
  });

  it('groups Coming up by day, with each day’s total', async () => {
    const shown = texts(await render());
    expect(shown.indexOf(dayLabel(1), shown.indexOf('Coming up'))).toBeGreaterThan(
      shown.indexOf('Coming up')
    );
    expect(shown.lastIndexOf(dayLabel(3))).toBeGreaterThan(shown.lastIndexOf(dayLabel(1)));
    expect(shown).toContain('Total out ₹25,000');
  });

  it('says what each section means in plain words', async () => {
    const shown = texts(await render());
    expect(shown.some((t) => t.includes('Food is ₹20,000 over'))).toBe(true);
    expect(shown).toContain('To collect');
  });

  it('opens each section’s own screen', async () => {
    const tree = await render();
    const byLabel = (start: string) =>
      tree.root.findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith(start) &&
          n.props.onPress
      )[0];
    act(() => byLabel('Budgets,').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/budgets');
    act(() => byLabel('Fuel, 25% used').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/budgets', params: { budget: 'b2' } });
    act(() => byLabel('Open loans').props.onPress());
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
    // The runway card scrolls down to Coming up instead of leaving the tab.
    (router.push as jest.Mock).mockClear();
    act(() => byLabel('Open Coming up').props.onPress());
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows a day’s items when you tap its pin on the runway, and jumps to it in the list', async () => {
    const tree = await render();
    // The pins are placed once the line knows its width.
    act(() =>
      tree.root
        .find((n) => n.props.testID === 'runway')
        .props.onLayout({ nativeEvent: { layout: { width: 300, height: 112 } } })
    );
    const label = dayLabel(3);
    const pin = () =>
      tree.root.find(
        (n) => n.props.accessibilityLabel === `${label}, ₹25,000 due. Show details` && n.props.onPress
      );
    (router.push as jest.Mock).mockClear();
    act(() => pin().props.onPress());
    expect(texts(tree)).toContain('See in list');
    expect(texts(tree).some((t) => t.includes('₹25,000 · Home loan'))).toBe(true);
    // Tapping it again hides the caption.
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel === `${label}, ₹25,000 due. Hide details`)
        .props.onPress()
    );
    expect(texts(tree)).not.toContain('See in list');
    act(() => pin().props.onPress());
    act(() =>
      tree.root.find((n) => n.props.accessibilityLabel === `See ${label} in the list`).props.onPress()
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('colours Coming up rows by how soon they are due', async () => {
    const { StyleSheet } = require('react-native');
    const { theme } = require('@/constants/theme');
    const tree = await render();
    const subColor = (start: string) =>
      StyleSheet.flatten(
        tree.root.findAllByType(Text).find((t) => [].concat(t.props.children).join('').startsWith(start))!
          .props.style
      ).color;
    // The EMI is 3 days out (amber); the streaming bill tomorrow is not an EMI or card bill.
    expect(subColor('EMI · ')).toBe(theme.colors.dueInk);
    expect(subColor('Bill · ')).toBe(theme.colors.textMuted);
  });

  it('marks an EMI paid straight from Coming up, showing what the account holds after', async () => {
    const tree = await render();
    const paid = tree.root.find((n) => n.props.accessibilityLabel === 'Pay Home loan EMI' && n.props.onPress);
    await act(async () => {
      paid.props.onPress({ stopPropagation: jest.fn() });
    });
    expect(mockPaySheet.current?.installment.id).toBe('p13');
    expect((mockPaySheet.current as unknown as { balanceMinor: number }).balanceMinor).toBe(3000000);
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

describe('Plan load recovery', () => {
  it('reports a failed card-bill read, offers retry, and replaces the error after a complete load', async () => {
    mockCards.mockRejectedValueOnce(new Error('Card bills unavailable'));
    const tree = await render();
    expect(texts(tree)).toContain('Card bills unavailable');
    expect(texts(tree)).not.toContain('Your accounts cover it');
    const retry = tree.root.findAll((n) => n.props.title === 'Try again' && n.props.onPress)[0];
    await act(async () => {
      await retry.props.onPress();
    });
    expect(texts(tree)).not.toContain('Card bills unavailable');
    expect(texts(tree)).toContain('Your accounts cover it');
    act(() => tree.unmount());
  });
});

it('keeps the latest Plan result when a previous privacy load resolves later', async () => {
  let release!: (value: never[]) => void;
  mockCards.mockImplementationOnce(
    () =>
      new Promise<never[]>((resolve) => {
        release = resolve;
      })
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PlanScreen />);
  });
  mockHideAmounts = true;
  mockBank = 1000000;
  try {
    await act(async () => {
      tree.update(<PlanScreen />);
    });
    expect(texts(tree)).toContain('₹10,000');
    await act(async () => {
      release([]);
    });
    expect(texts(tree)).toContain('₹10,000');
    expect(texts(tree)).not.toContain('₹30,000');
  } finally {
    act(() => tree.unmount());
    mockHideAmounts = false;
    mockBank = 3000000;
  }
});
