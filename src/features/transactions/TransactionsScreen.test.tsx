/**
 * Activity assembled: when the period-totals query fails, the list still shows (with a note) instead of the
 * skeleton hanging forever.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import type { Account, Transaction } from '@/types';

jest.setTimeout(60000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({
  HeaderIconButton: () => null,
  HeaderUserButton: () => null,
}));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
jest.mock('expo-router', () => ({
  router: { setParams: jest.fn(), push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ getState: () => ({ routes: [], index: 0 }) }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
// Sheets render only while open; the real one needs the keyboard controller's native module.
jest.mock('@/components/ModalSheet', () => ({ ModalSheet: () => null, SheetFooter: () => null }));
jest.mock('@/features/transactions/TransactionsSkeleton', () => ({
  TransactionsSkeleton: () => require('react').createElement(require('react-native').Text, null, 'SKELETON'),
}));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
const mockComparison: { fail: boolean; wait?: Promise<void> } = { fail: true };
const mockLedger = {
  transactions: [] as Transaction[],
  accounts: [{ id: 'bank', name: 'Bank', type: 'bank' }] as Account[],
};
const mockSearchTransactions = jest.fn(async (..._args: unknown[]): Promise<Transaction[]> => []);
jest.mock('@/db/reports', () => ({
  getRangeComparison: async () => {
    await mockComparison.wait;
    if (mockComparison.fail) throw new Error('db locked');
    const empty = {
      incomeMinor: 0,
      expenseMinor: 0,
      netMinor: 0,
      savingsContributionMinor: 0,
      categoryBreakdown: [],
      incomeBreakdown: [],
    };
    return { period: 'week', current: empty, previous: empty, incomeChangePct: null, expenseChangePct: null };
  },
}));
jest.mock('@/db/ledger', () => ({
  listTransactions: async () => mockLedger.transactions,
  listAccounts: async () => mockLedger.accounts,
  listCategories: async () => [],
  searchTransactions: (...args: unknown[]) => mockSearchTransactions(...args),
  setDayOrder: jest.fn(),
}));

import TransactionsScreen from '../../../app/(tabs)/transactions';

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children as never).join(''));

// Unmounted after each test, so the list's own batching timers don't fire once the test is over.
let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  mockLedger.transactions = [];
  mockLedger.accounts = [{ id: 'bank', name: 'Bank', type: 'bank' }] as Account[];
  mockSearchTransactions.mockReset();
  mockSearchTransactions.mockResolvedValue([]);
});

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<TransactionsScreen />);
  });
  mounted = tree;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree;
}

it('clears search in place and ignores results from the cleared query', async () => {
  const { HeaderIconButton } = require('@/components/AppHeader');
  const { TextInput } = require('@/components/Text');
  const { SearchStatus } = require('./ActivityFilterChips');
  let resolveSearch!: (rows: Transaction[]) => void;
  mockSearchTransactions.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSearch = resolve;
      })
  );
  const tree = await render();
  const headerAction = (label: string) =>
    tree.root.findAllByType(HeaderIconButton).find((n) => n.props.label === label)!;
  act(() => headerAction('Search transactions').props.onPress());
  act(() => tree.root.findByType(TextInput).props.onChangeText('coffee'));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(mockSearchTransactions).toHaveBeenCalledWith('coffee', 50);
  act(() => headerAction('Clear search').props.onPress());
  expect(tree.root.findByType(TextInput).props.value).toBe('');
  expect(headerAction('Close search')).toBeDefined();
  await act(async () => {
    resolveSearch([{ id: 'stale' } as Transaction]);
  });
  expect(tree.root.findByType(SearchStatus).props.resultCount).toBe(0);
  expect(tree.root.findByType(SearchStatus).props.loading).toBe(false);
});

describe('Activity when the totals query fails', () => {
  it("leaves the skeleton and says the totals couldn't load", async () => {
    mockComparison.fail = true;
    const shown = texts(await render());
    expect(shown).not.toContain('SKELETON');
    expect(shown).toContain("Couldn't load this period's totals");
    expect(shown).toContain('Nothing logged this week');
  });

  it('shows no note when the totals load', async () => {
    mockComparison.fail = false;
    const shown = texts(await render());
    expect(shown).not.toContain('SKELETON');
    expect(shown).not.toContain("Couldn't load this period's totals");
  });
});

describe('Activity period controls', () => {
  it('switches Week to Month from beside the period pill', async () => {
    mockComparison.fail = false;
    const tree = await render();
    expect(texts(tree)).toContain('This week');
    const month = tree.root.find(
      (n) =>
        n.props.accessibilityRole === 'radio' &&
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => t.props.children === 'Month')
    );
    await act(async () => month.props.onPress());
    // Let the month's load settle inside the test.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const radios = tree.root.findAll(
      (n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function'
    );
    // A pressable shows up once per layer it renders through; what matters is which labels are selected.
    const selected = new Set(
      radios
        .filter((n) => n.props.accessibilityState?.selected)
        .flatMap((n) => n.findAllByType(Text).map((t) => t.props.children))
    );
    // The type filter (All · Spent · …) is a radio group too; only the period switch is checked here.
    expect([...selected].filter((l) => l === 'Week' || l === 'Month')).toEqual(['Month']);
    expect(texts(tree)).toContain('Nothing logged this month');
  });
});

it('keeps the committed week caption while month data is still loading', async () => {
  mockComparison.fail = false;
  const tree = await render();
  let resolve!: () => void;
  mockComparison.wait = new Promise<void>((done) => {
    resolve = done;
  });
  const month = tree.root.find(
    (n) =>
      n.props.accessibilityRole === 'radio' &&
      typeof n.props.onPress === 'function' &&
      n.findAllByType(Text).some((t) => t.props.children === 'Month')
  );
  try {
    await act(async () => month.props.onPress());
    expect(texts(tree)).toContain('This week');
    expect(texts(tree)).toContain('Updating…');
    expect(texts(tree)).toContain('Nothing logged this week');
    expect(texts(tree)).not.toContain('Nothing logged this month');
    await act(async () => {
      resolve();
      await mockComparison.wait;
    });
    expect(texts(tree)).toContain('Nothing logged this month');
    expect(texts(tree)).not.toContain('Updating…');
  } finally {
    resolve();
    mockComparison.wait = undefined;
  }
});

it('clears a type-only filter and returns to All', async () => {
  const tree = await render();
  const button = (label: string) =>
    tree.root.findAll(
      (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
    )[0];
  await act(async () => button('Show spent').props.onPress());
  expect(button('Show spent').props.accessibilityState.selected).toBe(true);
  await act(async () => button('Clear all Activity filters').props.onPress());
  expect(button('Show all').props.accessibilityState.selected).toBe(true);
  expect(
    tree.root.findAll((node) => node.props.accessibilityLabel === 'Clear all Activity filters')
  ).toHaveLength(0);
});

it('does not mount pending refund expectations in Activity', async () => {
  mockComparison.fail = false;
  const tree = await render();
  const { PendingRefunds } = require('./PendingRefunds');
  expect(tree.root.findAllByType(PendingRefunds)).toHaveLength(0);
  act(() => tree.unmount());
});

it('ignores legacy payment metadata in Activity filters', async () => {
  const { FilterModal } = require('./FilterModal');
  const { ActivityFilterChips } = require('./ActivityFilterChips');
  const tree = await render();
  act(() =>
    tree.root
      .findByType(FilterModal)
      .props.onApply({ type: 'all', categoryIds: [], accountIds: ['bank'], paymentMode: 'upi' })
  );
  expect(tree.root.findByType(ActivityFilterChips).props.accountIds).toEqual(['bank']);
  expect(tree.root.findByType(ActivityFilterChips).props.filterCount).toBe(1);
  expect(texts(tree).join(' ')).not.toContain('Payment method');
});

it('counts investment transfers separately from ordinary transfers in the filter sheet', async () => {
  const { FilterModal } = require('./FilterModal');
  const { toLocalIsoDate } = require('@/lib/date');
  mockComparison.fail = false;
  mockLedger.accounts = [
    ...mockLedger.accounts,
    { id: 'fund', name: 'Fund', type: 'savings', investment: { kind: 'mutual_fund' } },
    { id: 'cash', name: 'Cash', type: 'cash' },
  ] as Account[];
  const transfer = {
    type: 'transfer',
    accountId: 'bank',
    categoryId: null,
    amountMinor: 10_000,
    date: toLocalIsoDate(new Date()),
    note: '',
  };
  mockLedger.transactions = [
    { ...transfer, id: 'investment', toAccountId: 'fund' },
    { ...transfer, id: 'ordinary-1', toAccountId: 'cash' },
    { ...transfer, id: 'ordinary-2', toAccountId: 'cash' },
  ] as Transaction[];
  const tree = await render();
  const countFor = tree.root.findByType(FilterModal).props.countFor;
  const filter = { categoryIds: [], accountIds: [] };
  expect(countFor({ ...filter, type: 'invest' })).toBe(1);
  expect(countFor({ ...filter, type: 'transfer' })).toBe(2);
});

it('recovers from an empty filter result in one action without changing the period', async () => {
  mockComparison.fail = false;
  const { toLocalIsoDate } = require('@/lib/date');
  const { FilterModal } = require('./FilterModal');
  const { PrimaryButton } = require('@/components/PrimaryButton');
  mockLedger.transactions = [
    {
      id: 'expense',
      type: 'expense',
      accountId: 'bank',
      categoryId: null,
      amountMinor: 10000,
      date: toLocalIsoDate(new Date()),
      note: '',
    },
  ] as Transaction[];
  const tree = await render();
  expect(texts(tree)).toContain('This week');
  act(() =>
    tree.root.findByType(FilterModal).props.onApply({
      type: 'income',
      categoryIds: ['missing'],
      accountIds: ['missing'],
      expenseLabel: 'absent',
    })
  );
  const clear = tree.root.findAllByType(PrimaryButton).find((n) => n.props.title === 'Clear filters');
  expect(clear).toBeDefined();
  act(() => clear!.props.onPress());
  expect(tree.root.findByType(FilterModal).props.filter).toEqual({
    type: 'all',
    categoryIds: [],
    accountIds: [],
    expenseLabel: undefined,
  });
  expect(tree.root.findAllByType(PrimaryButton).some((n) => n.props.title === 'Clear filters')).toBe(false);
  expect(texts(tree)).toContain('This week');
});
