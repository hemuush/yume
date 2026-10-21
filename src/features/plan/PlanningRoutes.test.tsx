import { act, create, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/useCollapsingHeader', () => ({
  useCollapsingHeader: () => ({ headerHeight: 0, collapse: 0, scrollHandler: jest.fn(), scrollRef: null }),
}));
jest.mock('@/features/budgets/useToday', () => ({ useToday: () => '2026-10-21' }));
jest.mock('@/features/home/HomeWallpaper', () => ({ HomeWallpaper: () => null }));
jest.mock('@/features/home/SkyHeader', () => ({ SkyHeader: () => null, HeaderSummary: () => null }));
jest.mock('@/components/MovingRow', () => ({ MovingRow: ({ children }: any) => children }));
jest.mock('@/components/Glass', () => ({
  ...jest.requireActual('@/components/Glass'),
  Glass: ({ children }: any) => children,
}));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('@/lib/useScreenLoad', () => ({
  useScreenLoad: (load: () => Promise<void>) => {
    require('react').useEffect(() => {
      void load();
    }, [load]);
    return { loaded: true, hasData: true, loadError: null, reload: load };
  },
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/db/ledger', () => ({
  listAccounts: jest.fn(async () => [
    { id: 'a', type: 'savings', name: 'Savings', currency: 'INR', archived: false },
  ]),
  listCategories: jest.fn(async () => []),
}));
jest.mock('@/db/budgets', () => ({
  listBudgetsForMonth: jest.fn(async () => [
    {
      budget: { id: 'b1', categoryId: 'food', periodMonth: '2026-10' },
      categoryName: 'Food',
      spentMinor: 10000,
      effectiveLimitMinor: 100000,
      remainingMinor: 90000,
      percentUsed: 10,
      overBudget: false,
    },
  ]),
  listLapsedBudgets: jest.fn(async () => []),
  createBudget: jest.fn(),
  deleteBudget: jest.fn(),
  restoreBudget: jest.fn(),
}));
jest.mock('@/db/savingsGoals', () => ({
  listSavingsGoals: jest.fn(),
  markGoalLetterRevealed: jest.fn(async () => {}),
}));

function mockStub(testID: string) {
  return (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID });
}
jest.mock('@/features/budgets/BudgetRow', () => ({ BudgetRow: mockStub('budget-row') }));
jest.mock('@/features/budgets/BudgetDetailModal', () => ({ BudgetDetailModal: mockStub('budget-overview') }));
jest.mock('@/features/budgets/AddBudgetModal', () => ({ AddBudgetModal: () => null }));
jest.mock('@/features/budgets/BudgetsHero', () => ({ BudgetsHero: () => null }));
jest.mock('@/features/goals/GoalCard', () => ({ GoalCard: mockStub('goal-card') }));
jest.mock('@/features/goals/GoalsHero', () => ({ GoalsHero: () => null }));
jest.mock('@/features/goals/GoalOverviewModal', () => ({ GoalOverviewModal: mockStub('goal-overview') }));
jest.mock('@/features/goals/AddGoalModal', () => ({ AddGoalModal: () => null }));
jest.mock('@/features/goals/ContributeModal', () => ({ ContributeModal: () => null }));
jest.mock('@/features/goals/GoalLetterReveal', () => ({
  GoalLetterReveal: () => require('react').createElement(require('react-native').Text, null, 'Sealed letter'),
}));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children, footer }: any) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));

import BudgetsScreen from '../../../app/budgets';
import SavingsGoalsScreen from '../../../app/savings-goals';
import { listSavingsGoals, markGoalLetterRevealed } from '@/db/savingsGoals';
import { PrimaryButton } from '@/components/PrimaryButton';
import { router } from 'expo-router';
import type { SavingsGoal } from '@/types';

const goal: SavingsGoal = {
  id: 'g1',
  name: 'Trip',
  currentAmountMinor: 10000,
  targetAmountMinor: 100000,
  targetDate: null,
  linkedAccountId: 'a',
  tracksAccount: true,
  archived: false,
  createdAt: '2026-01-01',
  noteToSelf: null,
  letterRevealed: false,
};
const roots: ReactTestRenderer[] = [];
async function render(node: React.ReactElement) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(node);
  });
  roots.push(tree);
  return tree;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockHide = false;
  jest.mocked(listSavingsGoals).mockResolvedValue([goal]);
});
afterEach(() => act(() => roots.splice(0).forEach((tree) => tree.unmount())));

it('opens a budget overview rather than pushing to a different screen', async () => {
  const tree = await render(<BudgetsScreen />);
  act(() => tree.root.findByProps({ testID: 'budget-row' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'budget-overview' }).props.progress.budget.id).toBe('b1');
  expect(router.push).not.toHaveBeenCalled();
});

it('opens the same goal overview flow as Plan and refreshes the selected goal in place', async () => {
  const tree = await render(<SavingsGoalsScreen />);
  act(() => tree.root.findByProps({ testID: 'goal-card' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'goal-overview' }).props.goal.id).toBe('g1');
  jest.mocked(listSavingsGoals).mockResolvedValueOnce([{ ...goal, currentAmountMinor: 20000 }]);
  await act(async () => {
    await tree.root.findByProps({ testID: 'goal-overview' }).props.onChanged();
  });
  expect(tree.root.findByProps({ testID: 'goal-overview' }).props.goal.currentAmountMinor).toBe(20000);
});

it('defers milestone letters while hidden and marks them read only after acknowledgement', async () => {
  mockHide = true;
  jest
    .mocked(listSavingsGoals)
    .mockResolvedValue([{ ...goal, currentAmountMinor: 100000, noteToSelf: 'My letter' }]);
  const tree = await render(<SavingsGoalsScreen />);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Sealed letter');
  expect(markGoalLetterRevealed).not.toHaveBeenCalled();
  mockHide = false;
  await act(async () => {
    tree.update(<SavingsGoalsScreen />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Sealed letter');
  expect(markGoalLetterRevealed).not.toHaveBeenCalled();
  await act(async () => {
    await tree.root
      .findAllByType(PrimaryButton)
      .find((n) => n.props.title === 'Nice, thanks Suu')!
      .props.onPress();
  });
  expect(markGoalLetterRevealed).toHaveBeenCalledWith('g1');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Sealed letter');
});

it('lets a failed letter acknowledgement close without immediately reopening it', async () => {
  jest
    .mocked(listSavingsGoals)
    .mockResolvedValue([{ ...goal, currentAmountMinor: 100000, noteToSelf: 'My letter' }]);
  jest
    .mocked(markGoalLetterRevealed)
    .mockRejectedValueOnce(new Error('receipt unavailable'))
    .mockRejectedValueOnce(new Error('receipt unavailable'));
  const tree = await render(<SavingsGoalsScreen />);
  await act(async () => {
    await tree.root
      .findAllByType(PrimaryButton)
      .find((n) => n.props.title === 'Nice, thanks Suu')!
      .props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Sealed letter');
  await act(async () => {
    await tree.root.findByType(require('@/components/ModalSheet').ModalSheet).props.onClose();
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Sealed letter');
});
