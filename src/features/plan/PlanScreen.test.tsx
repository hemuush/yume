/**
 * Renders the Plan tab with fixed data: every section shows its real
 * figures, in priority order, and tapping a section opens its own screen.
 * What each section says is tested in planOverview.test.ts; this checks the
 * screen wires it all up.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// The first render loads React Native's component tree, which on a cold, fully
// parallel run (CI, or the whole suite at once) can take longer than Jest's
// 5s default — seen failing that way, never on its own. Generous, not slow.
jest.setTimeout(30000);
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
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
      nextRunDate: '2999-01-01',
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
    { loanId: 'l1', paidCount: 12, totalCount: 120, nextDueDate: '2999-01-05', nextEmiMinor: 2500000 },
  ],
}));
jest.mock('@/db/people', () => ({ listPeople: async () => [{ balanceMinor: 50000 }] }));
jest.mock('@/db/ledger', () => ({
  listAccounts: async () => [],
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

// Loads React Native's lazily-required components once, up front, with a
// generous budget — on a cold, fully parallel run (CI) their first load can
// outlast a single test's time limit, which failed this file intermittently.
beforeAll(async () => {
  await render();
}, 180000);

describe('Plan tab', () => {
  it('shows every section, in priority order, loans first', async () => {
    const shown = texts(await render());
    const headings = [
      'Loans',
      'Due in the next 2 weeks',
      'Coming up',
      'Budgets',
      'Friends & Family',
      'Saving toward',
      'Daily habit',
    ];
    const positions = headings.map((h) => shown.indexOf(h));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("shows each section's own figures", async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'Debt left',
        'Home loan',
        'Streaming',
        '1 over',
        'Owed to you',
        'Start a goal',
        '4-day streak',
      ])
    );
    // What-if picks the biggest category a cut could apply to, not the EMI.
    expect(shown.some((t) => t.includes('less on Food?'))).toBe(true);
    expect(shown.some((t) => t.includes('less on Loan EMI'))).toBe(false);
    // 25% of the home loan's principal repaid.
    expect(shown.some((t) => t.startsWith('25% paid off'))).toBe(true);
  });

  it('opens each section’s own screen', async () => {
    const tree = await render();
    // First match: a loan also appears in Coming up as its next EMI, and
    // both open Loans.
    const byLabel = (start: string) =>
      tree.root.findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith(start) &&
          n.props.onPress
      )[0];
    act(() => byLabel('Home loan').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/loans');
    act(() => byLabel('Owed to you').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/people');
    act(() => byLabel('Start a goal').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/savings-goals');
    act(() => byLabel('Open the what-if sandbox').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/whatif');
    act(() => byLabel('Open Recurring').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/recurring');
    act(() => byLabel('4-day streak').props.onPress());
    expect(router.push).toHaveBeenLastCalledWith('/garden');
  });
});
