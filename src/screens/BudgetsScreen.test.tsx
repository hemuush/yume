/**
 * Budgets assembled on a real database: what it shows, which sheets open, and what does not make the page behind them
 * redraw. The rows and the hero are counted through wrappers that render the real ones; the sheets are stand-ins that
 * record what they were given.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(90000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn(), select: jest.fn() },
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null, HeaderIconButton: () => null }));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
  PrivacyProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/features/budgets/useToday', () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { useToday: () => iso };
});
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

const mockDrawn: { rows: string[]; hero: number } = { rows: [], hero: 0 };
const mockSheet: {
  detail: string | null;
  closeDetail: (() => void) | null;
  form: { visible: boolean; editing: string | null };
  menu: { visible: boolean; items: { key: string; onPress: () => void }[] };
} = {
  detail: null,
  closeDetail: null,
  form: { visible: false, editing: null },
  menu: { visible: false, items: [] },
};
jest.mock('@/features/budgets/BudgetRow', () => {
  const actual = jest.requireActual('@/features/budgets/BudgetRow');
  return {
    BudgetRow: (props: { progress: { budget: { id: string } } }) => {
      mockDrawn.rows.push(props.progress.budget.id);
      return actual.BudgetRow(props);
    },
  };
});
jest.mock('@/features/budgets/BudgetsHero', () => {
  const actual = jest.requireActual('@/features/budgets/BudgetsHero');
  return {
    BudgetsHero: (props: unknown) => {
      mockDrawn.hero++;
      return actual.BudgetsHero(props);
    },
  };
});
jest.mock('@/features/budgets/BudgetDetailModal', () => ({
  BudgetDetailModal: (props: { progress: { budget: { id: string } }; onClose: () => void }) => {
    mockSheet.detail = props.progress.budget.id;
    mockSheet.closeDetail = props.onClose;
    return null;
  },
}));
jest.mock('@/features/budgets/AddBudgetModal', () => ({
  AddBudgetModal: (props: { visible: boolean; editing: { budget: { id: string } } | null }) => {
    mockSheet.form = { visible: props.visible, editing: props.editing?.budget.id ?? null };
    return null;
  },
}));
jest.mock('@/components/ActionSheet', () => ({
  ActionSheet: (props: { visible: boolean; items: { key: string; onPress: () => void }[] }) => {
    mockSheet.menu = { visible: props.visible, items: props.items };
    return null;
  },
}));

import { Text } from 'react-native';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { createBudget } from '@/db/budgets';
import { createAccount, createCategory } from '@/db/ledger';
import { clearReadCache } from '@/db/readCache';
import { resetSettingsCache, setDefaultCurrency, setHasOnboarded, setUserName } from '@/db/settings';
import { createTransaction } from '@/db/transactions';
import { toLocalIsoDate } from '@/lib/date';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import BudgetsScreen from '@/features/budgets/BudgetsWorkspace';

const today = toLocalIsoDate(new Date());
let mounted: ReactTestRenderer | null = null;
let bankId = '';
let foodId = '';
let transportId = '';

async function seed() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  clearReadCache();
  await setDefaultCurrency('INR');
  await setUserName('Tester');
  await setHasOnboarded(true);
  bankId = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 5_000_000 })
  ).id;
  foodId = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  transportId = (await createCategory({ name: 'Transport', kind: 'expense' })).id;
  await createBudget({ categoryId: foodId, limitAmountMinor: 600_000, rollover: false });
  await createBudget({ categoryId: transportId, limitAmountMinor: 300_000, rollover: false });
}

const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function openBudgets() {
  await act(async () => {
    mounted = create(<BudgetsScreen />);
  });
  await settle(50);
  await settle(50);
  return mounted!;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat(5).join(''));
const rows = (tree: ReactTestRenderer) => tree.root.findAllByType(BudgetRow);
const showAgain = () =>
  act(async () => {
    mockFocus.forEach((cb) => {
      const undo = cb();
      if (typeof undo === 'function') mockUndo.push(undo);
    });
  });
const addButton = (tree: ReactTestRenderer) =>
  tree.root.find((n) => typeof n.props.onPress === 'function' && n.props.label === '+ Add');

beforeEach(async () => {
  mockFocus.clear();
  Object.assign(mockDrawn, { rows: [], hero: 0 });
  Object.assign(mockSheet, {
    detail: null,
    closeDetail: null,
    form: { visible: false, editing: null },
    menu: { visible: false, items: [] },
  });
  await seed();
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  // A focus effect that was run by hand leaves its timer (the one to the next midnight) until undone.
  mockUndo.splice(0).forEach((undo) => undo());
});

it('lists each budget under "This month"', async () => {
  const tree = await openBudgets();
  expect(texts(tree)).toContain('This month');
  expect(rows(tree)).toHaveLength(2);
  expect(mockDrawn.hero).toBeGreaterThan(0);
});

it('opens a budget’s detail from its row', async () => {
  const tree = await openBudgets();
  const first = rows(tree)[0];
  act(() => first.props.onPress());
  expect(mockSheet.detail).toBe(first.props.progress.budget.id);
  act(() => mockSheet.closeDetail!());
});

it('opens the "Edit limit / Delete" menu from a row, and Edit limit opens the form on that budget', async () => {
  const tree = await openBudgets();
  const second = rows(tree)[1];
  act(() => second.props.onMore());
  expect(mockSheet.menu.visible).toBe(true);
  expect(mockSheet.menu.items.map((i) => i.key)).toEqual(['edit', 'delete']);
  act(() => mockSheet.menu.items[0].onPress());
  expect(mockSheet.form).toEqual({ visible: true, editing: second.props.progress.budget.id });
});

it('opens a blank form from the header', async () => {
  const tree = await openBudgets();
  act(() => addButton(tree).props.onPress());
  expect(mockSheet.form).toEqual({ visible: true, editing: null });
});

it('does not redraw the rows or the hero when a sheet opens or closes', async () => {
  const tree = await openBudgets();
  await settle(200);
  const drawn = { rows: mockDrawn.rows.length, hero: mockDrawn.hero };
  act(() => rows(tree)[0].props.onPress());
  act(() => mockSheet.closeDetail!());
  act(() => rows(tree)[1].props.onMore());
  act(() => addButton(tree).props.onPress());
  expect(mockDrawn.rows.length).toBe(drawn.rows);
  expect(mockDrawn.hero).toBe(drawn.hero);
});

it('draws nothing again for a reload that found the same budgets', async () => {
  await openBudgets();
  await settle(200);
  const drawn = { rows: mockDrawn.rows.length, hero: mockDrawn.hero };
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.rows.length).toBe(drawn.rows);
  expect(mockDrawn.hero).toBe(drawn.hero);
});

it('draws only the budget that changed when something is spent in its category', async () => {
  await openBudgets();
  await settle(200);
  const drawn = mockDrawn.rows.length;
  const spent = await mockDb.getAllAsync<{ id: string }>('SELECT id FROM budgets WHERE category_id = ?', [
    foodId,
  ]);
  await createTransaction({
    type: 'expense',
    accountId: bankId,
    categoryId: foodId,
    amountMinor: 120_000,
    date: today,
    note: 'Groceries',
  });
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.rows.slice(drawn)).toEqual([spent[0].id]);
});
