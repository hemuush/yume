/**
 * Renders the Plan tab with fixed data: every tile shows its live line, and
 * tapping a tile opens that tile's own screen.
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
    { percentUsed: 50, overBudget: false },
    { percentUsed: 95, overBudget: false },
  ],
}));
jest.mock('@/db/savingsGoals', () => ({
  listSavingsGoals: async () => [
    { name: 'Goa trip', currentAmountMinor: 64000, targetAmountMinor: 100000, archived: false },
  ],
}));
jest.mock('@/db/recurring', () => ({
  listRecurringRules: async () => [
    { id: 'r1', type: 'expense', active: true, nextRunDate: '2999-01-01', note: 'Rent', categoryId: null },
  ],
}));
jest.mock('@/db/loans', () => ({
  listLoans: async () => [{ status: 'active' }],
  getNextDueInstallment: async () => null,
}));
jest.mock('@/db/people', () => ({ listPeople: async () => [{}, {}] }));
jest.mock('@/db/ledger', () => ({ listAccounts: async () => [], listCategories: async () => [] }));
jest.mock('@/db/reports', () => ({ getDailyGoalStreakSeries: async () => [{ streakDays: 4 }] }));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getDailySpendingGoal: async () => 50000,
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
  it('shows every tile with its live line', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'Budgets',
        '1 of 2 on track',
        'Goals',
        'Goa trip · 64%',
        'Recurring',
        'Loans & people',
        '1 loan · 2 people',
        'What-if',
        "Suu's Garden",
        '4-day streak',
      ])
    );
    expect(shown.some((t) => t.startsWith('Rent '))).toBe(true);
  });

  it("opens a tile's own screen when tapped", async () => {
    const tree = await render();
    const loansTile = tree.root.find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Loans & people') &&
        n.props.onPress
    );
    act(() => loansTile.props.onPress());
    expect(router.push).toHaveBeenCalledWith('/loans');
  });
});
