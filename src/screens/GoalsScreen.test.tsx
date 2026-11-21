/**
 * Savings goals assembled on a real database: which sheets open, and what does not make the goal rows behind them redraw.
 * The rows are counted through a wrapper that renders the real card; the sheets are stand-ins that record what they got.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(90000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null, HeaderIconButton: () => null }));
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
// The page's own sheet (the goal letter) and the others are not under test (and pull in the keyboard controller's native module).
jest.mock('@/components/ModalSheet', () => ({ ModalSheet: () => null }));
// Every focus effect the page has registered; "showing the screen again" runs them and keeps what they return to undo.
const mockFocus = new Set<() => void | (() => void)>();
const mockUndo: (() => void)[] = [];
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void | (() => void)) => {
    mockFocus.add(cb);
    require('react').useEffect(cb, [cb]);
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    useSafeAreaInsets: () => inset,
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
  };
});

const mockDrawn: { cards: string[]; hero: number } = { cards: [], hero: 0 };
const mockSheet: {
  editing: string | null;
  closeEditing: (() => void) | null;
  contributing: string | null;
  closeContribute: (() => void) | null;
  adding: boolean;
  closeAdd: (() => void) | null;
} = {
  editing: null,
  closeEditing: null,
  contributing: null,
  closeContribute: null,
  adding: false,
  closeAdd: null,
};
jest.mock('@/features/goals/GoalCard', () => {
  const actual = jest.requireActual('@/features/goals/GoalCard');
  return {
    GoalCard: (props: { goal: { name: string } }) => {
      mockDrawn.cards.push(props.goal.name);
      return actual.GoalCard(props);
    },
  };
});
// The totals card draws its saved figure once each time it is drawn.
jest.mock('@/features/goals/GoalsHero', () => {
  const actual = jest.requireActual('@/features/goals/GoalsHero');
  return {
    GoalsHero: (props: unknown) => {
      mockDrawn.hero++;
      return actual.GoalsHero(props);
    },
  };
});
jest.mock('@/features/goals/GoalOverviewModal', () => ({
  GoalOverviewModal: (props: { goal: { name: string }; onClose: () => void }) => {
    mockSheet.editing = props.goal.name;
    mockSheet.closeEditing = props.onClose;
    return null;
  },
}));
jest.mock('@/features/goals/ContributeModal', () => ({
  ContributeModal: (props: { goal: { name: string } | null; onClose: () => void }) => {
    mockSheet.contributing = props.goal?.name ?? null;
    mockSheet.closeContribute = props.onClose;
    return null;
  },
}));
jest.mock('@/features/goals/AddGoalModal', () => ({
  AddGoalModal: (props: { visible: boolean; onClose: () => void }) => {
    mockSheet.adding = props.visible;
    mockSheet.closeAdd = props.onClose;
    return null;
  },
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { contributeToGoal, createSavingsGoal } from '@/db/savingsGoals';
import { clearReadCache } from '@/db/readCache';
import { resetSettingsCache, setDefaultCurrency, setHasOnboarded, setUserName } from '@/db/settings';
import { AddButton } from '@/components/AddButton';
import { GoalCard } from '@/features/goals/GoalCard';
import SavingsGoalsScreen from '@/features/goals/GoalsWorkspace';

let mounted: ReactTestRenderer | null = null;
const ids: Record<string, string> = {};

async function seed() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  clearReadCache();
  await setDefaultCurrency('INR');
  await setUserName('Tester');
  await setHasOnboarded(true);
  for (const [name, target, saved] of [
    ['Goa trip', 10_000_000, 2_000_000],
    ['New phone', 3_000_000, 500_000],
    ['Emergency fund', 50_000_000, 10_000_000],
  ] as const) {
    const goal = await createSavingsGoal({
      name,
      targetAmountMinor: target,
      targetDate: null,
      linkedAccountId: null,
    });
    ids[name] = goal.id;
    await contributeToGoal(goal.id, saved);
  }
}

const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function openGoals() {
  await act(async () => {
    mounted = create(<SavingsGoalsScreen />);
  });
  await settle(50);
  await settle(50);
  return mounted!;
}
const showAgain = () =>
  act(async () => {
    mockFocus.forEach((cb) => {
      const undo = cb();
      if (typeof undo === 'function') mockUndo.push(undo);
    });
  });
const card = (tree: ReactTestRenderer, goalName: string) =>
  tree.root.findAllByType(GoalCard).find((n) => n.props.goal.name === goalName)!;
const tapCard = (tree: ReactTestRenderer, goalName: string) =>
  act(() => card(tree, goalName).props.onPress());
const tapContribute = (tree: ReactTestRenderer, goalName: string) =>
  act(() => card(tree, goalName).props.onContribute());

beforeEach(async () => {
  mockFocus.clear();
  Object.assign(mockDrawn, { cards: [], hero: 0 });
  Object.assign(mockSheet, {
    editing: null,
    closeEditing: null,
    contributing: null,
    closeContribute: null,
    adding: false,
    closeAdd: null,
  });
  await seed();
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  // A focus effect that was run by hand leaves its timer (the one to the next midnight) until undone.
  mockUndo.splice(0).forEach((undo) => undo());
});

it('lists each goal once, and opens its details, its add-money sheet and the new-goal form', async () => {
  const tree = await openGoals();
  expect(new Set(mockDrawn.cards)).toEqual(new Set(['Goa trip', 'New phone', 'Emergency fund']));
  tapCard(tree, 'New phone');
  expect(mockSheet.editing).toBe('New phone');
  act(() => mockSheet.closeEditing!());
  tapContribute(tree, 'Goa trip');
  expect(mockSheet.contributing).toBe('Goa trip');
  act(() => mockSheet.closeContribute!());
  expect(mockSheet.contributing).toBeNull();
  act(() => tree.root.findByType(AddButton).props.onPress());
  expect(mockSheet.adding).toBe(true);
  act(() => mockSheet.closeAdd!());
  expect(mockSheet.adding).toBe(false);
});

it('does not redraw the goal rows or the totals when a sheet opens or closes', async () => {
  const tree = await openGoals();
  await settle(200);
  const drawn = { cards: mockDrawn.cards.length, hero: mockDrawn.hero };
  expect(drawn.cards).toBeGreaterThan(0);
  expect(drawn.hero).toBeGreaterThan(0);
  tapCard(tree, 'New phone');
  act(() => mockSheet.closeEditing!());
  tapContribute(tree, 'Goa trip');
  act(() => mockSheet.closeContribute!());
  act(() => tree.root.findByType(AddButton).props.onPress());
  act(() => mockSheet.closeAdd!());
  expect({ cards: mockDrawn.cards.length, hero: mockDrawn.hero }).toEqual(drawn);
});

it('draws nothing again for a reload that found the same goals', async () => {
  await openGoals();
  await settle(200);
  const drawn = { cards: mockDrawn.cards.length, hero: mockDrawn.hero };
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect({ cards: mockDrawn.cards.length, hero: mockDrawn.hero }).toEqual(drawn);
});

it('draws only the goal that changed when money is added to one', async () => {
  await openGoals();
  await settle(200);
  const drawn = mockDrawn.cards.length;
  await contributeToGoal(ids['New phone'], 100_000);
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.cards.slice(drawn)).toEqual(['New phone']);
});
