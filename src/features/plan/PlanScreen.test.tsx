/**
 * Renders the Plan tab with fixed data dated from today: the runway, jars, debt path, goals and tiles show
 * real figures in order and open their screens, Coming up lists 30 days grouped by day with Pay on EMIs.
 * Wording rules are in planOverview.test.ts and runway.test.ts.
 */
import { formatMoney } from '@/lib/money';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// The first render loads React Native's component tree; on a cold parallel run (CI) that can exceed Jest's
// 5s default, so the timeout is generous.
jest.setTimeout(30000);
jest.mock('@/db/investmentHistory', () => ({
  listInvestmentHistory: jest.fn(async () => ({ flows: [], valuations: [] })),
}));
jest.mock('@/db/refundTracking', () => ({ listExpectedRefunds: jest.fn(async () => []) }));
import { ScrollView, Text } from 'react-native';

jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(require('react-native').View, null, children),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHideAmounts }) }));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
const mockUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockUndo }) }));
/** YYYY-MM-DD, `n` days from today. */
const mockDay = (n: number) => {
  const { addDaysToIsoDate, toLocalIsoDate } = require('@/lib/date');
  return addDaysToIsoDate(toLocalIsoDate(new Date()), n);
};
let mockTab: string | undefined;
let mockUpcoming: string | undefined;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({ tab: mockTab, upcoming: mockUpcoming }),
  // useScreenLoad's focus effect: run once, like a first focus.
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/db/budgets', () => ({
  listLapsedBudgets: async () => [],
  listBudgetsForMonth: async () => [
    {
      budget: { id: 'b1', categoryId: 'food', periodMonth: mockDay(0).slice(0, 7) },
      categoryName: 'Food',
      categoryIcon: 'tag',
      categoryColor: '#4E83CC',
      spentMinor: 3000000,
      effectiveLimitMinor: 1000000,
      remainingMinor: -2000000,
      percentUsed: 300,
      overBudget: true,
    },
    {
      budget: { id: 'b2', categoryId: 'fuel', periodMonth: mockDay(0).slice(0, 7) },
      categoryName: 'Fuel',
      categoryIcon: 'gas-station',
      categoryColor: '#4E83CC',
      spentMinor: 100000,
      effectiveLimitMinor: 400000,
      remainingMinor: 300000,
      percentUsed: 25,
      overBudget: false,
    },
  ],
}));
let mockGoals: import('@/types').SavingsGoal[] = [];
let mockOverdueLoan = false;
jest.mock('@/db/savingsGoals', () => ({ listSavingsGoals: async () => mockGoals }));
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
    ...(mockSip
      ? [
          {
            id: 'sip1',
            type: 'transfer',
            active: true,
            nextRunDate: mockDay(1),
            amountMinor: 500000,
            note: 'SIP',
            categoryId: null,
            accountId: 'bank',
            toAccountId: 'groww',
          },
        ]
      : []),
  ],
}));
jest.mock('@/db/loans', () => ({
  listPendingLoanPayments: jest.fn(async () => [
    { id: 'p13', loanId: 'l1', dueDate: mockDay(mockOverdueLoan ? -1 : 3), emiAmountMinor: 2500000 },
  ]),
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
  getLoanPaymentContext: jest.fn(async () => ({
    installment: { id: 'p13', installmentNumber: 13, dueDate: mockDay(3), emiAmountMinor: 2500000 },
    account: { id: 'bank', name: 'Bank' },
    categoryId: 'emi',
  })),
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
/** A test turns this on to add a monthly SIP from the bank into an investment account. */
let mockSip = false;
jest.mock('@/db/ledger', () => ({
  listAccounts: async () => [
    ...(mockSip
      ? [
          {
            id: 'groww',
            name: 'Groww',
            type: 'savings',
            currency: 'INR',
            archived: false,
            currentBalanceMinor: 4000000,
            createdAt: '2025-01-01 10:00:00',
            investment: {
              investedMinor: 4000000,
              takenOutMinor: 0,
              gainMinor: null,
              valuedAt: null,
              lastValueMinor: null,
            },
          },
        ]
      : []),
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
// What the what-if tile is chosen from: the biggest categories first (a test may add rent above food).
const mockAverages: { rows: { categoryId: string; name: string; totalMinor: number }[] } = { rows: [] };
const defaultAverages = () => [
  { categoryId: 'emi', name: 'Loan EMI', totalMinor: 3000000 },
  { categoryId: 'food', name: 'Food', totalMinor: 2000000 },
];
jest.mock('@/db/reports', () => ({
  getDailyGoalStreakSeries: async () => [0, 1, 2, 3, 4].map((n) => ({ streakDays: n })),
  // Loan EMI is the biggest, but it's a built-in category — What-if skips it.
  getCategoryMonthlyAverages: async () => (mockAverages.rows.length ? mockAverages.rows : defaultAverages()),
}));
jest.mock('@/db/monthlyPlan', () => ({
  getMonthlyPlanIncome: async () => null,
  setMonthlyPlanIncome: async () => {},
}));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getHiddenSubscriptionSuggestions: async () => [],
  getDailySpendingGoal: async () => 500000,
  getDefaultCurrency: async () => 'INR',
}));

jest.mock('@/features/budgets/BudgetDetailModal', () => ({
  BudgetDetailModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'plan-budget-detail' }),
}));
jest.mock('@/features/loans/LoanDetailModal', () => ({
  LoanDetailModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'plan-loan-detail' }),
}));
jest.mock('@/features/people/PersonDetailModal', () => ({
  PersonDetailModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'plan-person-detail' }),
}));
jest.mock('@/features/profile/AddAccountModal', () => ({
  AddAccountModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'plan-new-account' }),
}));
jest.mock('@/features/budgets/AddBudgetModal', () => ({
  AddBudgetModal: (props: { visible: boolean }) =>
    props.visible
      ? require('react').createElement(require('react-native').View, { ...props, testID: 'plan-new-budget' })
      : null,
}));
jest.mock('@/features/loans/AddLoanModal', () => ({
  AddLoanModal: (props: { visible: boolean }) =>
    props.visible
      ? require('react').createElement(require('react-native').View, { ...props, testID: 'plan-new-loan' })
      : null,
}));
jest.mock('@/features/recurring/RuleModal', () => ({
  RuleModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'plan-rule' }),
}));
jest.mock('@/features/transactions/TransactionDetailModal', () => ({
  TransactionDetailModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'plan-refund-detail' }),
}));
jest.mock('@/features/goals/GoalOverviewModal', () => ({
  GoalOverviewModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'plan-goal-overview' }),
}));
jest.mock('@/features/goals/AddGoalModal', () => ({
  AddGoalModal: (props: { visible: boolean }) =>
    props.visible
      ? require('react').createElement(require('react-native').View, { ...props, testID: 'plan-new-goal' })
      : null,
}));
import PlanScreen from '../../../app/(tabs)/plan';
import { router } from 'expo-router';

// Bars and rings animate to their values (useDrawnValue); fake timers keep those
// frames inside the test instead of firing after it ends.
jest.useFakeTimers();

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PlanScreen />);
  });
  await act(async () => {}); // let the load’s promises settle
  return tree;
}

/** The Home loan EMI row: it ends in a Pay pill and opens the pay sheet. */
/** Switch Plan's tab the way the segmented control does. */
const openTab = (tree: ReactTestRenderer, tab: 'overview' | 'upcoming' | 'money' | 'debt') =>
  act(() => tree.root.findByType(require('./PlanNavigation').PlanNavigation).props.onChange(tab));

/** Same, but lets the sections it mounts finish loading before the test moves on. */
const openTabAndSettle = (tree: ReactTestRenderer, tab: 'overview' | 'upcoming' | 'money' | 'debt') =>
  act(async () => tree.root.findByType(require('./PlanNavigation').PlanNavigation).props.onChange(tab));

const payRow = (tree: ReactTestRenderer) => {
  openTab(tree, 'upcoming');
  const dates = tree.root.findAll((n) => n.props.testID?.startsWith('outgoing-day-') && n.props.onPress);
  act(() => dates[dates.length - 1].props.onPress());
  return tree.root.find(
    (n) =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith('Home loan, EMI') &&
      n.props.accessibilityLabel.endsWith(', Pay') &&
      typeof n.props.onPress === 'function'
  );
};

const planScroll = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(ScrollView).find((view) => view.props.testID === 'plan-content')!;

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

// Loads RN's lazily-required components once up front with a generous budget: on a cold parallel run (CI)
// their first load can outlast a test's limit and fail this file intermittently.
beforeAll(async () => {
  await render();
}, 180000);

describe('Plan tab', () => {
  it('opens the existing account setup and closes it after creation', async () => {
    const tree = await render();
    const { RunwayCard } = require('./RunwayCard');
    act(() => tree.root.findByType(RunwayCard).props.onAddAccount());
    expect(tree.root.findByProps({ testID: 'plan-new-account' }).props.visible).toBe(true);
    await act(async () => tree.root.findByProps({ testID: 'plan-new-account' }).props.onCreated());
    expect(tree.root.findAllByProps({ testID: 'plan-new-account' })).toHaveLength(0);
    act(() => tree.unmount());
  });
  it('opens Budgets directly from a route and keeps add/detail actions inside Plan', async () => {
    mockTab = 'budgets';
    try {
      const tree = await render();
      const { PlanNavigation } = require('./PlanNavigation');
      expect(tree.root.findByType(PlanNavigation).props.value).toBe('money');
      expect(texts(tree)).toEqual(expect.arrayContaining(['Food', 'Fuel']));
      act(() =>
        tree.root
          .findAll(
            (node) => String(node.props.accessibilityLabel).startsWith('Fuel,') && node.props.onPress
          )[0]
          .props.onPress()
      );
      expect(tree.root.findByProps({ testID: 'plan-budget-detail' }).props.progress.budget.id).toBe('b2');
      act(() => tree.root.findByProps({ testID: 'plan-budget-detail' }).props.onClose());
      act(() =>
        tree.root
          .findAll((n) => n.props.accessibilityLabel === 'Add to your plan' && n.props.onPress)[0]
          .props.onPress()
      );
      act(() =>
        tree.root
          .findAll((n) => n.props.accessibilityLabel === 'Add budget' && n.props.onPress)[0]
          .props.onPress()
      );
      expect(tree.root.findByProps({ testID: 'plan-new-budget' }).props.visible).toBe(true);
      expect(router.push).not.toHaveBeenCalled();
      act(() => tree.unmount());
    } finally {
      mockTab = undefined;
    }
  });
  it('opens the full schedule from the upcoming preview', async () => {
    const tree = await render();
    const button = tree.root.findAll(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel === 'View payments' &&
        n.props.onPress
    )[0];
    expect(button).toBeDefined();
    act(() => button.props.onPress());
    expect(tree.root.findByType(require('./PlanNavigation').PlanNavigation).props.value).toBe('upcoming');
  });
  it('opens today’s payment group from the overdue alert', async () => {
    mockOverdueLoan = true;
    const tree = await render();
    try {
      const alert = tree.root.findAll(
        (node) =>
          typeof node.props.onPress === 'function' &&
          String(node.props.accessibilityLabel).startsWith('1 overdue payment.')
      )[0];
      act(() => alert.props.onPress());
      const today = tree.root.findAllByProps({ testID: `outgoing-day-${mockDay(0)}` })[0];
      expect(today.props.accessibilityState.selected).toBe(true);
      expect(texts(tree)).not.toContain('Streaming');
    } finally {
      mockOverdueLoan = false;
      act(() => tree.unmount());
    }
  });
  it('opens a pending refund purchase over Plan', async () => {
    const tree = await render();
    const { PendingRefunds } = require('@/features/transactions/PendingRefunds');
    act(() => tree.root.findByType(PendingRefunds).props.onOpen({ id: 'refund-purchase' }));
    expect(tree.root.findByProps({ testID: 'plan-refund-detail' }).props.tx.id).toBe('refund-purchase');
    expect(router.push).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
  it('shows the balance with its verdict, then the sections of Overview', async () => {
    const shown = texts(await render());
    const headings = [
      'Runway · next 30 days',
      'Covered',
      'Needs attention',
      'People & habit',
      'Friends',
      'Spend streak',
    ];
    const positions: number[] = [];
    for (const h of headings) positions.push(shown.indexOf(h, (positions.at(-1) ?? -1) + 1));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it('shows its tabs from the first frame, so the page does not drop by their height when the data lands', async () => {
    const { PlanNavigation } = require('./PlanNavigation');
    const { CardRowsSkeleton } = require('@/components/ListSkeleton');
    let tree!: ReactTestRenderer;
    // A synchronous act: the load has started but none of its promises have settled.
    act(() => {
      tree = create(<PlanScreen />);
    });
    expect(tree.root.findAllByType(CardRowsSkeleton).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(PlanNavigation)).toHaveLength(1);
    await act(async () => {});
    expect(tree.root.findAllByType(CardRowsSkeleton)).toHaveLength(0);
    expect(tree.root.findAllByType(PlanNavigation)).toHaveLength(1);
    expect(
      tree.root.findAllByType(ScrollView).some((scroll) => scroll.findAllByType(PlanNavigation).length > 0)
    ).toBe(false);
    act(() => tree.unmount());
  });

  it('refreshes visible Plan amounts without switching tabs', async () => {
    const tree = await render();
    try {
      expect(texts(tree)).toContain('₹30,000');
      mockBank = 2200000;
      await act(async () => planScroll(tree).props.refreshControl.props.onRefresh());
      expect(texts(tree)).toContain('₹22,000');
      expect(tree.root.findByType(require('./PlanNavigation').PlanNavigation).props.value).toBe('overview');
    } finally {
      mockBank = 3000000;
      act(() => tree.unmount());
    }
  });

  it('does not suggest cutting rent, insurance or a subscription: they are fixed, like an EMI', async () => {
    mockAverages.rows = [
      { categoryId: 'rent', name: 'Rent', totalMinor: 2500000 },
      { categoryId: 'ins', name: 'Insurance', totalMinor: 2200000 },
      { categoryId: 'food', name: 'Food', totalMinor: 2000000 },
    ];
    try {
      const tab = await render();
      await openTabAndSettle(tab, 'money');
      expect(texts(tab)).toContain('Food −10% saves ₹2,000 a\u00A0month');
      expect(texts(tab).some((t) => t.startsWith('Rent −') || t.startsWith('Insurance −'))).toBe(false);
    } finally {
      mockAverages.rows = [];
    }
  });

  it('shows each section’s own figures', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(expect.arrayContaining(['₹500', '4 days', 'Food', '₹30,000']));
    expect(shown.some((t) => t.endsWith('over budget'))).toBe(true);
    expect(shown).toContain('Next payments');
    expect(shown).toContain('Streaming');
    // The Goals tab holds what-if: it cuts the biggest category it can, not the EMI (10% of Food's ₹20,000).
    const goalsTab = await render();
    await openTabAndSettle(goalsTab, 'money');
    expect(texts(goalsTab)).toContain('Food −10% saves ₹2,000 a\u00A0month');
    // 25% of the home loan's principal repaid.
    expect(shown.some((t) => t.includes('25% repaid'))).toBe(false);
  });

  it('says whether your accounts cover what’s due, and when they run short', async () => {
    expect(texts(await render())).toContain('Covered');
    mockBank = 1000000;
    try {
      const tree = await render();
      const shown = texts(tree);
      expect(shown).not.toContain('Covered');
      expect(shown).toContain('Current balance');
      expect(shown.some((t) => t.startsWith('First shortfall'))).toBe(true);
      expect(shown).toContain('₹15,450 more needed');
      const details = tree.root.find(
        (node) =>
          typeof node.props.onPress === 'function' &&
          String(node.props.accessibilityLabel).startsWith('Forecast details.')
      );
      act(() => details.props.onPress());
      expect(texts(tree).some((t) => t.startsWith('Lowest'))).toBe(true);
      act(() => tree.unmount());
    } finally {
      mockBank = 3000000;
    }
  });

  it('includes the SIP in the next-day total and opens that day from Overview', async () => {
    mockSip = true;
    try {
      const tree = await render();
      expect(texts(tree).some((t) => t.includes(`${formatMoney(545000)} due`))).toBe(true);
      const viewDay = tree.root.findAll(
        (node) => node.props.accessibilityLabel === 'View day — Next payments' && node.props.onPress
      )[0];
      act(() => viewDay.props.onPress());
      const day = tree.root.findAllByProps({ testID: `outgoing-day-${mockDay(1)}` })[0];
      expect(day.props.accessibilityState.selected).toBe(true);
      const shown = texts(tree);
      expect(shown).toContain('SIP · Groww');
      expect(shown).toContain('from Bank');
      // Streaming ₹450 plus the ₹5,000 SIP, in the day's heading.
      expect(shown.some((t) => t.includes(`${formatMoney(545000)} out`))).toBe(true);
    } finally {
      mockSip = false;
    }
  });

  it('lists every upcoming payment under All, and only a picked date’s payments after picking it', async () => {
    const tree = await render();
    openTab(tree, 'upcoming');
    expect(texts(tree)).toContain('Streaming');
    expect(texts(tree)).toContain('Home loan');
    const dates = tree.root.findAll((n) => n.props.testID?.startsWith('outgoing-day-') && n.props.onPress);
    // "All" first, then each date.
    expect(dates.length).toBeGreaterThan(2);
    expect(dates[0].props.testID).toBe('outgoing-day-all');
    act(() => dates[dates.length - 1].props.onPress());
    expect(texts(tree)).toContain('Home loan');
    expect(texts(tree)).not.toContain('Streaming');
    expect(texts(tree).some((t) => t.includes('₹25,000'))).toBe(true);
    act(() => tree.unmount());
  });

  it('puts the first block the same distance under the tabs on every tab, so switching tabs shifts nothing', async () => {
    const { StyleSheet } = require('react-native');
    const { PlanNavigation } = require('./PlanNavigation');
    const tree = await render();
    const gap = () => {
      const nav = tree.root.findByType(PlanNavigation);
      let node = nav.parent;
      while (node && !StyleSheet.flatten(node.props.style)?.marginHorizontal) node = node.parent;
      return StyleSheet.flatten(node!.props.style).marginBottom as number;
    };
    for (const tab of ['overview', 'upcoming', 'money', 'debt'] as const) {
      await openTabAndSettle(tree, tab);
      const inset = planScroll(tree).props.contentContainerStyle.paddingTop;
      const sectionInset = tab === 'upcoming' ? 8 : 0;
      expect(gap() + inset + sectionInset).toBe(12);
    }
    act(() => tree.unmount());
  });

  it('keeps the Upcoming subtitle with its heading, as one short line the link beside it cannot wrap', async () => {
    const tree = await render();
    openTab(tree, 'upcoming');
    expect(texts(tree)).toContain('Next 30 days');
    expect(texts(tree).some((t) => t.startsWith('Bills, EMIs, SIPs'))).toBe(false);
    act(() => tree.unmount());
  });

  it('writes a picked date and an unpicked one in the same weight, so picking one moves none of the others', async () => {
    const { StyleSheet } = require('react-native');
    const tree = await render();
    openTab(tree, 'upcoming');
    const weights = () =>
      tree.root
        .findAll((n) => n.props.testID?.startsWith('outgoing-day-') && n.props.onPress)
        .map((chip) => StyleSheet.flatten(chip.findByType(Text).props.style).fontFamily);
    const before = weights();
    expect(new Set(before).size).toBe(1);
    const dates = tree.root.findAll((n) => n.props.testID?.startsWith('outgoing-day-') && n.props.onPress);
    act(() => dates[dates.length - 1].props.onPress());
    expect(weights()).toEqual(before);
    act(() => tree.unmount());
  });

  it('says what each section means in plain words', async () => {
    const shown = texts(await render());
    // The over-limit budget's own tile says it; no caption names it.
    expect(shown.some((t) => t.endsWith('over budget'))).toBe(true);
    expect(shown.some((t) => t.includes('Food is ₹20,000 over'))).toBe(false);
    expect(shown).toContain('To collect');
  });

  it('opens collection workspaces inside Plan and keeps links to Recurring and What-if', async () => {
    const tree = await render();
    const byLabel = (start: string) =>
      tree.root.findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith(start) &&
          n.props.onPress
      )[0];
    openTab(tree, 'money');
    expect(router.push).not.toHaveBeenCalled();
    expect(tree.root.findByType(require('@/features/plan/PlanNavigation').PlanNavigation).props.value).toBe(
      'money'
    );
    await act(async () => {});
    expect(texts(tree)).toEqual(expect.arrayContaining(['Budgets', 'Goals', 'Investments', 'Fuel']));
    expect(router.push).not.toHaveBeenCalled();
    act(() => byLabel('Fuel, ').props.onPress());
    const detail = tree.root.findByProps({ testID: 'plan-budget-detail' });
    expect(detail.props.progress.budget.id).toBe('b2');
    act(() => detail.props.onClose());
    openTab(tree, 'overview');
    act(() => byLabel('Friends & Family').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/people');
    act(() => byLabel('4-day streak').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/garden');
    // The Overview's Upcoming, Goals and Debt headers go to their tabs instead of leaving Plan.
    (router.push as jest.Mock).mockClear();
    act(() => byLabel('View payments').props.onPress());
    expect(router.push).not.toHaveBeenCalled();
    expect(byLabel('Manage recurring rules')).toBeUndefined();
    expect(router.push).not.toHaveBeenCalled();
    await openTabAndSettle(tree, 'money');
    expect(router.push).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Investments');
    act(() => byLabel('Open the what-if sandbox').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/whatif',
      params: { category: 'food', cut: '10' },
    });
    await openTabAndSettle(tree, 'debt');
    expect(texts(tree)).toContain('EMIs a month');
    act(() => byLabel('Home loan, ').props.onPress());
    expect(tree.root.findByProps({ testID: 'plan-loan-detail' }).props.loan.id).toBe('l1');
  });

  it('keeps the Upcoming direction when returning from another Plan tab', async () => {
    const tree = await render();
    openTab(tree, 'upcoming');
    const income = () =>
      tree.root
        .findAll((node) => node.props.accessibilityRole === 'radio' && node.props.onPress)
        .filter((node) => node.findAllByType(Text).some((label) => label.props.children === 'Money in'))[0];
    act(() => income().props.onPress());
    expect(income().props.accessibilityState.checked).toBe(true);
    openTab(tree, 'overview');
    openTab(tree, 'upcoming');
    expect(income().props.accessibilityState.checked).toBe(true);
  });

  it('opens the payment agenda from a legacy Recurring link inside Plan', async () => {
    mockTab = 'upcoming';
    mockUpcoming = 'recurring';
    try {
      const tree = await render();
      expect(texts(tree)).toContain('Upcoming payments');
      expect(router.setParams).toHaveBeenCalledWith({ tab: undefined, upcoming: undefined });
    } finally {
      mockTab = undefined;
      mockUpcoming = undefined;
    }
  });

  it('opens on Upcoming when Home sends you there, then forgets it was asked', async () => {
    mockTab = 'upcoming';
    try {
      const tree = await render();
      expect(tree.root.findAll((n) => n.props.testID === 'runway').length).toBeGreaterThan(0);
      expect(texts(tree)).not.toContain('People & habit');
      expect(router.setParams).toHaveBeenCalledWith({ tab: undefined });
    } finally {
      mockTab = undefined;
    }
  });

  it('has four tabs, and only the chosen one is drawn', async () => {
    const tree = await render();
    const navigation = require('./PlanNavigation');
    expect(navigation.PLAN_TABS.map((o: { label: string }) => o.label)).toEqual([
      'Overview',
      'Upcoming',
      'Money plan',
      'Debt',
    ]);
    expect(texts(tree)).toContain('People & habit');
    await openTabAndSettle(tree, 'upcoming');
    expect(texts(tree)).not.toContain('People & habit');
    expect(tree.root.findAll((n) => n.props.testID === 'runway').length).toBeGreaterThan(0);
    await openTabAndSettle(tree, 'money');
    expect(texts(tree)).not.toContain('Spending accounts');
    expect(texts(tree)).toContain('Budgets');
    await openTabAndSettle(tree, 'debt');
    expect(texts(tree)).not.toContain('Spending accounts');
    expect(texts(tree)).toContain('Your loans');
    expect(texts(tree).filter((label) => label === 'Next payment')).toHaveLength(1);
    await openTabAndSettle(tree, 'overview');
    expect(texts(tree)).toContain('People & habit');
  });

  it('colours Coming up rows by how soon they are due', async () => {
    const { StyleSheet } = require('react-native');
    const { theme } = require('@/constants/theme');
    const tree = await render();
    openTab(tree, 'upcoming');
    const subColor = (start: string) =>
      StyleSheet.flatten(
        tree.root.findAllByType(Text).find((t) => [].concat(t.props.children).join('').startsWith(start))!
          .props.style
      ).color;
    // The EMI is 3 days out (amber); the streaming bill tomorrow is not an EMI or card bill.
    expect(subColor('Bill')).not.toBe(theme.colors.warnInk);
    expect(subColor('Bill')).not.toBe(theme.colors.expenseText);
    const dates = tree.root.findAll((n) => n.props.testID?.startsWith('outgoing-day-') && n.props.onPress);
    act(() => dates[dates.length - 1].props.onPress());
    expect(subColor('EMI · ')).toBe(theme.colors.warnInk);
  });

  it('marks an EMI paid straight from Coming up, showing what the account holds after', async () => {
    const tree = await render();
    const paid = payRow(tree);
    await act(async () => {
      paid.props.onPress();
    });
    expect(mockPaySheet.current?.installment.id).toBe('p13');
    expect((mockPaySheet.current as unknown as { balanceMinor: number }).balanceMinor).toBe(3000000);
  });
});

describe('Plan load recovery', () => {
  it('reports a failed card-bill read, offers retry, and replaces the error after a complete load', async () => {
    mockCards.mockRejectedValueOnce(new Error('Card bills unavailable'));
    const tree = await render();
    expect(texts(tree)).toContain('Card bills unavailable');
    expect(texts(tree)).not.toContain('Covered');
    const retry = tree.root.findAll((n) => n.props.title === 'Try again' && n.props.onPress)[0];
    await act(async () => {
      await retry.props.onPress();
    });
    expect(texts(tree)).not.toContain('Card bills unavailable');
    expect(texts(tree)).toContain('Covered');
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
    expect(tree.root.findByType(require('./RunwayCard').RunwayCard).props.runway.startMinor).toBe(1000000);
    await act(async () => {
      release([]);
    });
    expect(tree.root.findByType(require('./RunwayCard').RunwayCard).props.runway.startMinor).toBe(1000000);
    expect(texts(tree).some((t) => t.includes('₹30,000'))).toBe(false);
  } finally {
    act(() => tree.unmount());
    mockHideAmounts = false;
    mockBank = 3000000;
  }
});

it('opens individual Plan items directly, ignores repeated taps, and closes back onto the same Plan tree', async () => {
  const tree = await render();
  const tap = (label: string) =>
    act(() => tree.root.find((n) => n.props.accessibilityLabel === label && n.props.onPress).props.onPress());
  const scroll = planScroll(tree);
  const scrollTo = jest.spyOn(scroll.instance, 'scrollTo');
  scrollTo.mockClear();
  (router.push as jest.Mock).mockClear();
  tap('Open Ravi details');
  tap('Open Ravi details');
  const person = tree.root.findByProps({ testID: 'plan-person-detail' });
  expect(person.props.person.id).toBe('p1');
  expect(person.props.initialTab).toBe('history');
  act(() => person.props.onClose());
  expect(router.push).not.toHaveBeenCalled();
  expect(scrollTo).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: 'plan-person-detail' })).toHaveLength(0);
  expect(texts(tree)).toContain('Debt');
  act(() => tree.unmount());
});

it('ignores an obsolete payment lookup when another item is opened and coalesces repeated Pay taps', async () => {
  const context = require('@/db/loans').getLoanPaymentContext as jest.Mock;
  let release!: (value: unknown) => void;
  context.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const tree = await render();
  const pay = payRow(tree);
  const before = context.mock.calls.length;
  let request!: Promise<void>;
  act(() => {
    request = pay.props.onPress();
    pay.props.onPress();
  });
  expect(context.mock.calls.length - before).toBe(1);
  openTab(tree, 'overview');
  act(() =>
    tree.root
      .find((n) => n.props.accessibilityLabel === 'Open Ravi details' && n.props.onPress)
      .props.onPress()
  );
  await act(async () => {
    release({ installment: { id: 'old' }, account: null, categoryId: 'emi' });
    await request;
  });
  expect(
    tree.root.findAllByType(require('@/features/loans/PayInstallmentSheet').PayInstallmentSheet)
  ).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'plan-person-detail' }).props.person.id).toBe('p1');
  act(() => tree.unmount());
});

it('opens a savings goal directly, preserves Plan on close, and creates a goal without a collection-page detour', async () => {
  mockGoals = [
    {
      id: 'g1',
      name: 'Emergency fund',
      targetAmountMinor: 500000,
      currentAmountMinor: 100000,
      targetDate: null,
      linkedAccountId: null,
      tracksAccount: false,
      archived: false,
      createdAt: '2026-01-01',
      noteToSelf: null,
      letterRevealed: false,
    },
  ];
  let tree!: ReactTestRenderer;
  try {
    tree = await render();
    (router.push as jest.Mock).mockClear();
    await openTabAndSettle(tree, 'money');
    const { GoalCard } = require('@/features/goals/GoalCard');
    const row = tree.root.findByType(GoalCard);
    act(() => row.props.onPress());
    const overview = tree.root.findByProps({ testID: 'plan-goal-overview' });
    expect(overview.props.goal.id).toBe('g1');
    act(() => overview.props.onClose());
    expect(tree.root.findAllByProps({ testID: 'plan-goal-overview' })).toHaveLength(0);
    expect(
      tree.root.findAll((node) => node.props.accessibilityLabel === 'Add goal' && node.props.onPress)
    ).toHaveLength(0);
    act(() =>
      tree.root
        .findAll((node) => node.props.accessibilityLabel === 'Add to your plan' && node.props.onPress)[0]
        .props.onPress()
    );
    act(() =>
      tree.root
        .findAll((node) => node.props.accessibilityLabel === 'Add goal' && node.props.onPress)[0]
        .props.onPress()
    );
    const create = tree.root.findByProps({ testID: 'plan-new-goal' });
    expect(create.props.visible).toBe(true);
    act(() => create.props.onClose());
    expect(router.push).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Goals');
  } finally {
    if (tree) act(() => tree.unmount());
    mockGoals = [];
  }
});

it('opens budget setup and a scheduled rule without leaving Plan', async () => {
  const tree = await render();
  await openTabAndSettle(tree, 'money');
  const scroll = planScroll(tree);
  expect(
    tree.root.findAll((node) => node.props.accessibilityLabel === 'Add budget' && node.props.onPress)
  ).toHaveLength(0);
  act(() =>
    tree.root
      .findAll((node) => node.props.accessibilityLabel === 'Add to your plan' && node.props.onPress)[0]
      .props.onPress()
  );
  act(() =>
    tree.root
      .findAll((node) => node.props.accessibilityLabel === 'Add budget' && node.props.onPress)[0]
      .props.onPress()
  );
  expect(tree.root.findByProps({ testID: 'plan-new-budget' }).props.editing).toBeNull();
  act(() => tree.root.findByProps({ testID: 'plan-new-budget' }).props.onClose());
  openTab(tree, 'upcoming');
  const row = tree.root.find(
    (n) =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith('Streaming, Bill') &&
      typeof n.props.onPress === 'function'
  );
  act(() => row.props.onPress());
  expect(tree.root.findByProps({ testID: 'plan-rule' }).props.editing.id).toBe('r1');
  act(() => tree.root.findByProps({ testID: 'plan-rule' }).props.onClose());
  expect(planScroll(tree)).toBe(scroll);
  expect(router.push).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

it('creates recurring rules and loans directly from Plan and keeps management links', async () => {
  mockTab = undefined;
  const tree = await render();
  const press = (label: string) =>
    act(() =>
      tree.root.findAll((n) => n.props.onPress && n.props.accessibilityLabel === label)[0].props.onPress()
    );
  press('Add to your plan');
  expect(texts(tree)).toEqual(
    expect.arrayContaining(['Add recurring', 'Add loan', 'Add budget', 'Add goal', 'Add investment'])
  );
  press('Add recurring');
  let rule = tree.root.findByProps({ testID: 'plan-rule' });
  expect(rule.props.editing).toBeNull();
  expect(rule.props.accounts.length).toBeGreaterThan(0);
  await act(async () => rule.props.onSaved());
  expect(tree.root.findAllByProps({ testID: 'plan-rule' })).toHaveLength(0);
  expect(texts(tree)).not.toContain('Add goal');
  press('Add to your plan');
  press('Add budget');
  const budget = tree.root.findByProps({ testID: 'plan-new-budget' });
  expect(budget.props.visible).toBe(true);
  act(() => budget.props.onClose());
  press('Add to your plan');
  press('Add goal');
  const goal = tree.root.findByProps({ testID: 'plan-new-goal' });
  expect(goal.props.visible).toBe(true);
  act(() => goal.props.onClose());
  press('Add to your plan');
  press('Add investment');
  const investment = tree.root.findAllByProps({ testID: 'plan-new-account' })[0];
  expect(investment.props.initialChoice).toBe('investment');
  act(() => investment.props.onClose());
  openTab(tree, 'upcoming');
  expect(texts(tree)).toContain('Upcoming payments');
  press('Add to your plan');
  press('Add recurring');
  rule = tree.root.findByProps({ testID: 'plan-rule' });
  act(() => rule.props.onClose());
  await openTabAndSettle(tree, 'debt');
  expect(texts(tree)).not.toContain('Add loan');
  press('Add to your plan');
  press('Add loan');
  const loan = tree.root.findByProps({ testID: 'plan-new-loan' });
  expect(loan.props.visible).toBe(true);
  await act(async () => loan.props.onCreated());
  expect(tree.root.findAllByProps({ testID: 'plan-new-loan' })).toHaveLength(0);
  expect(router.push).not.toHaveBeenCalledWith('/add-transaction');
  act(() => tree.unmount());
});

it('keeps full collections out of Overview and opens an over-budget exception directly', async () => {
  const tree = await render();
  expect(tree.root.findAllByType(require('./BudgetJars').BudgetJars)).toHaveLength(0);
  expect(tree.root.findAllByType(require('./PlanGoals').GoalsStrip)).toHaveLength(0);
  expect(tree.root.findAllByType(require('./DebtPath').DebtPath)).toHaveLength(0);
  const warning = tree.root.findAll(
    (n) => n.props.accessibilityLabel?.startsWith('Food.') && n.props.onPress
  )[0];
  act(() => warning.props.onPress());
  expect(tree.root.findByProps({ testID: 'plan-budget-detail' }).props.progress.budget.id).toBe('b1');
  act(() => tree.unmount());
});
