/**
 * Activity assembled: when the period-totals query fails, the list still shows (with a note) instead of the
 * skeleton hanging forever.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

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
  listTransactions: async () => [],
  listAccounts: async () => [{ id: 'bank', name: 'Bank', type: 'bank' }],
  listCategories: async () => [],
  searchTransactions: async () => [],
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
