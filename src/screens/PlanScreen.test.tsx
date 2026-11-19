/**
 * Plan assembled on a real database: what it shows, which sheets open, and what does not make the page behind them redraw.
 * The tabs and their sections are counted through wrappers that render the real ones.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(90000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn(), select: jest.fn() },
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null, HeaderIconButton: () => null }));
// Sheets show their content only while open; the real one needs the keyboard controller's native module.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, title }: { children: unknown; title?: string }) =>
    require('react').createElement(
      require('react').Fragment,
      null,
      require('react').createElement(require('react-native').Text, null, title),
      children
    ),
}));
// Every focus effect the page has registered; "showing the screen again" runs them and keeps what they return to undo.
const mockFocus = new Set<() => void | (() => void)>();
const mockUndo: (() => void)[] = [];
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), setParams: jest.fn() },
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
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
  PrivacyProvider: ({ children }: { children: unknown }) => children,
}));

// How often each part of the page was drawn, and what it was last given.
const mockDrawn = { overview: 0, upcoming: 0, runway: 0, panels: 0 };
const mockSeen: { actions: import('@/features/plan/planActions').PlanActions | null; budget: string | null } =
  {
    actions: null,
    budget: null,
  };
jest.mock('@/features/plan/PlanOverviewTab', () => {
  const actual = jest.requireActual('@/features/plan/PlanOverviewTab');
  const Inner = actual.PlanOverviewTab.type;
  return {
    PlanOverviewTab: require('react').memo(
      (props: { actions: import('@/features/plan/planActions').PlanActions }) => {
        mockDrawn.overview++;
        mockSeen.actions = props.actions;
        return Inner(props);
      }
    ),
  };
});
jest.mock('@/features/plan/PlanUpcomingTab', () => {
  const actual = jest.requireActual('@/features/plan/PlanUpcomingTab');
  const Inner = actual.PlanUpcomingTab.type;
  return {
    PlanUpcomingTab: require('react').memo((props: unknown) => {
      mockDrawn.upcoming++;
      return Inner(props);
    }),
  };
});
jest.mock('@/features/plan/RunwayCard', () => {
  const actual = jest.requireActual('@/features/plan/RunwayCard');
  return {
    ...actual,
    RunwayCard: (props: unknown) => {
      mockDrawn.runway++;
      return actual.RunwayCard(props);
    },
  };
});
jest.mock('@/features/plan/PlanOverviewPanels', () => {
  const actual = jest.requireActual('@/features/plan/PlanOverviewPanels');
  return {
    ...actual,
    PlanOverviewPanels: (props: unknown) => {
      mockDrawn.panels++;
      return actual.PlanOverviewPanels(props);
    },
  };
});
jest.mock('@/features/budgets/BudgetDetailModal', () => ({
  BudgetDetailModal: (props: { progress: { budget: { id: string } }; onClose: () => void }) => {
    mockSeen.budget = props.progress.budget.id;
    mockBudgetClose.fn = props.onClose;
    return null;
  },
}));
const mockBudgetClose: { fn: (() => void) | null } = { fn: null };
jest.mock('@/features/transactions/PendingRefunds', () => ({ PendingRefunds: () => null }));
jest.mock('@/features/loans/LoanComparison', () => ({ LoanComparison: () => null }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { createBudget } from '@/db/budgets';
import { createRecurringRule } from '@/db/recurring';
import { bumpDataVersion } from '@/db/dataVersion';
import { clearReadCache } from '@/db/readCache';
import { resetSettingsCache, setDefaultCurrency, setUserName, setHasOnboarded } from '@/db/settings';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import PlanScreen from '../../app/(tabs)/plan';
import { UndoToastProvider } from '@/components/UndoToast';

const today = toLocalIsoDate(new Date());
let mounted: ReactTestRenderer | null = null;

async function seed() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  clearReadCache();
  await setDefaultCurrency('INR');
  await setUserName('Tester');
  await setHasOnboarded(true);
  const bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 5_000_000 })
  ).id;
  const rent = (await createCategory({ name: 'Rent', kind: 'expense' })).id;
  const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  await createBudget({ categoryId: food, limitAmountMinor: 600_000, rollover: false });
  await createRecurringRule({
    type: 'expense',
    accountId: bank,
    categoryId: rent,
    amountMinor: 1_800_000,
    note: 'Rent',
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: addDaysToIsoDate(today, 3),
  });
}

const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function openPlan() {
  await act(async () => {
    mounted = create(
      <UndoToastProvider>
        <PlanScreen />
      </UndoToastProvider>
    );
  });
  await settle(50);
  await settle(50);
  return mounted!;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat(5).join(''));

beforeEach(async () => {
  mockFocus.clear();
  Object.assign(mockDrawn, { overview: 0, upcoming: 0, runway: 0, panels: 0 });
  Object.assign(mockSeen, { actions: null, budget: null });
  mockBudgetClose.fn = null;
  await seed();
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  // A focus effect that was run by hand leaves its timer (the one to the next midnight) until undone.
  mockUndo.splice(0).forEach((undo) => undo());
});

it('shows the plan once it has loaded: the tabs, what is due, and the habit', async () => {
  const tree = await openPlan();
  const shown = texts(tree);
  expect(shown).toEqual(
    expect.arrayContaining(['Overview', 'Upcoming', 'Money plan', 'Debt', 'People & habit'])
  );
  expect(mockDrawn.overview).toBeGreaterThan(0);
  expect(mockSeen.actions).not.toBeNull();
});

it('shows each tab on its own', async () => {
  const tree = await openPlan();
  await act(async () => mockSeen.actions!.selectTab('upcoming'));
  expect(texts(tree)).toContain('Upcoming payments');
  await act(async () => mockSeen.actions!.selectTab('overview'));
  expect(texts(tree)).toContain('People & habit');
});

it('opens a budget’s sheet from Overview, and closes it', async () => {
  await openPlan();
  const budgets = await mockDb.getAllAsync<{ id: string }>('SELECT id FROM budgets');
  act(() => mockSeen.actions!.openDetail('budget', budgets[0].id));
  expect(mockSeen.budget).toBe(budgets[0].id);
  mockSeen.budget = null;
  act(() => mockBudgetClose.fn!());
  // Closed: the sheet is gone, so nothing renders it any more.
  expect(mockSeen.budget).toBeNull();
});

it('does not redraw the page behind a sheet when one opens or closes', async () => {
  const tree = await openPlan();
  await settle(200);
  const before = { ...mockDrawn };
  const budgets = await mockDb.getAllAsync<{ id: string }>('SELECT id FROM budgets');
  act(() => mockSeen.actions!.openDetail('budget', budgets[0].id));
  act(() => mockBudgetClose.fn!());
  const add = tree.root.find(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Add to your plan'
  );
  act(() => add.props.onPress());
  expect(texts(tree)).toContain('Add to your plan');
  expect(mockDrawn).toEqual(before);
});

it('draws only what refreshes itself for a reload that found nothing new', async () => {
  await openPlan();
  await settle(200);
  const before = { ...mockDrawn };
  bumpDataVersion();
  clearReadCache();
  await act(async () => {
    mockFocus.forEach((cb) => {
      const undo = cb();
      if (typeof undo === 'function') mockUndo.push(undo);
    });
  });
  await settle(100);
  await settle(100);
  // The reload found the same plan: what the Overview tab is made of holds the same things, so none of it is drawn
  // again.
  expect(mockDrawn.runway).toBe(before.runway);
  expect(mockDrawn.panels).toBe(before.panels);
});
