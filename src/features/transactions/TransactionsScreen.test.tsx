/**
 * Activity assembled: when the period-totals query fails, the list still shows (with a note) instead of the
 * skeleton hanging forever.
 */
import { Profiler } from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, BackHandler } from 'react-native';
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
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { setParams: jest.fn(), push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams,
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

// Only the words of each Text: a nested Text (the date after a day's name) is listed on its own.
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) =>
    ([] as unknown[])
      .concat(t.props.children)
      .filter((c) => typeof c === 'string' || typeof c === 'number')
      .join('')
  );

// Unmounted after each test, so the list's own batching timers don't fire once the test is over.
let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  mockParams = {};
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
  // One more than the list holds, so "there are more" is known rather than guessed.
  expect(mockSearchTransactions).toHaveBeenCalledWith('coffee', 51);
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
  it('leaves the skeleton and says the totals couldn’t load', async () => {
    mockComparison.fail = true;
    const shown = texts(await render());
    expect(shown).not.toContain('SKELETON');
    expect(shown).toContain('Couldn’t load this period’s totals');
    expect(shown).toContain('Nothing logged this week');
  });

  it('shows no note when the totals load', async () => {
    mockComparison.fail = false;
    const shown = texts(await render());
    expect(shown).not.toContain('SKELETON');
    expect(shown).not.toContain('Couldn’t load this period’s totals');
  });
});

describe('Activity period controls', () => {
  it('writes Week and Month in the same weight, picked or not, so switching never moves the word beside it', async () => {
    const { StyleSheet } = require('react-native');
    mockComparison.fail = false;
    const tree = await render();
    const weightOf = (label: string) =>
      StyleSheet.flatten(tree.root.findAllByType(Text).find((t) => t.props.children === label)!.props.style)
        .fontFamily;
    const week = weightOf('Week');
    expect(weightOf('Month')).toBe(week);
    const month = tree.root.find(
      (n) =>
        n.props.accessibilityRole === 'radio' &&
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => t.props.children === 'Month')
    );
    await act(async () => month.props.onPress());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(weightOf('Week')).toBe(week);
    expect(weightOf('Month')).toBe(week);
  });

  it('fills the picked word with the theme’s ink only, and moves the fill when the other word is picked', async () => {
    const { StyleSheet } = require('react-native');
    const { themeInk } = require('@/theme/interactionColors');
    mockComparison.fail = false;
    const tree = await render();
    const radio = (word: string) =>
      tree.root.find(
        (n) =>
          n.props.accessibilityRole === 'radio' &&
          typeof n.props.onPress === 'function' &&
          n.findAllByType(Text).some((t) => t.props.children === word)
      );
    const filled = () =>
      ['Week', 'Month'].filter((word) => {
        const raw = radio(word).props.style;
        const style = StyleSheet.flatten(typeof raw === 'function' ? raw({ pressed: false }) : raw);
        return style?.backgroundColor === themeInk('#9EC5FC');
      });
    expect(filled()).toEqual(['Week']);
    await act(async () => radio('Month').props.onPress());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(filled()).toEqual(['Month']);
  });

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

  it('dims the arrow to a period that has not started, even though a press eases opacity too', async () => {
    const { StyleSheet } = require('react-native');
    const { theme } = require('@/constants/theme');
    mockComparison.fail = false;
    const tree = await render();
    const next = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Next week' &&
        typeof n.props.onPressIn === 'function' &&
        typeof n.type !== 'string'
    );
    // Today is in the current week, so there is nothing after it: disabled and visibly so.
    expect(next.props.disabled).toBe(true);
    expect(StyleSheet.flatten(next.props.style).opacity).toBe(theme.opacity.limit);
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

it('opens the chart and totals in an Insights sheet from the Spent strip', async () => {
  const { ModalSheet } = require('@/components/ModalSheet');
  const { ActivitySummaryStrip } = require('./ActivitySummaryStrip');
  const dimensions = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 390, height: 800, fontScale: 1, scale: 3 });
  const tree = await render();
  const insights = () =>
    tree.root
      .findAllByType(ModalSheet)
      .find((sheet: { props: { title?: string } }) => sheet.props.title === 'Insights')!;
  expect(insights().props.visible).toBe(false);
  // Short and with nothing to type into, so it sits flush at the bottom instead of using the scrolling layout.
  expect(insights().props.scrollable).toBe(false);
  act(() => tree.root.findByType(ActivitySummaryStrip).props.onPress());
  expect(insights().props.visible).toBe(true);
  act(() => insights().props.onClose());
  expect(insights().props.visible).toBe(false);
  act(() => tree.unmount());
  dimensions.mockRestore();
});

it('keeps the period pill and the Week | Month switch on the 16 dp gutters, side by side or stacked at large text', async () => {
  const { StyleSheet } = require('react-native');
  // Nothing is pulled out past the gutter by a negative margin: the pill's and the switch's own edges are the edges.
  const pulledOut = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => {
      if (typeof n.type !== 'string') return false;
      const flat = StyleSheet.flatten(n.props.style);
      return !!flat && (flat.marginLeft === -10 || flat.marginRight === -10);
    }).length;
  const switchStyle = (tree: ReactTestRenderer) =>
    StyleSheet.flatten(
      tree.root.find(
        (n) =>
          typeof n.type === 'string' &&
          n.props.accessibilityRole === 'radiogroup' &&
          !!StyleSheet.flatten(n.props.style)?.borderRadius
      ).props.style
    );
  const wide = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 412, height: 900, fontScale: 1, scale: 3 });
  const tree = await render();
  expect(pulledOut(tree)).toBe(0);
  expect(switchStyle(tree).alignSelf).toBeUndefined();
  act(() => tree.unmount());
  wide.mockReturnValue({ width: 412, height: 900, fontScale: 1.5, scale: 3 });
  const big = await render();
  expect(pulledOut(big)).toBe(0);
  // Stacked: the switch takes the full width under the pill, its two buttons sharing it.
  expect(switchStyle(big).alignSelf).toBe('stretch');
  // ...and the pill above it spans the width too, its arrows at the ends.
  const pillStyle = (tree: ReactTestRenderer) =>
    StyleSheet.flatten(
      tree.root.find(
        (n) =>
          typeof n.type === 'string' &&
          StyleSheet.flatten(n.props.style)?.overflow === 'hidden' &&
          StyleSheet.flatten(n.props.style)?.minHeight === 44
      ).props.style
    );
  expect(pillStyle(big).alignSelf).toBe('stretch');
  act(() => big.unmount());
  wide.mockRestore();
});

describe('Activity search results', () => {
  const entry = (id: string, date: string): Transaction =>
    ({
      id,
      type: 'expense',
      accountId: 'bank',
      categoryId: null,
      amountMinor: 10000,
      date,
      note: '',
    }) as Transaction;

  async function searchFor(rows: Transaction[]) {
    const { HeaderIconButton } = require('@/components/AppHeader');
    const { TextInput } = require('@/components/Text');
    mockComparison.fail = false;
    mockSearchTransactions.mockResolvedValue(rows);
    const tree = await render();
    act(() =>
      tree.root
        .findAllByType(HeaderIconButton)
        .find((n) => n.props.label === 'Search transactions')!
        .props.onPress()
    );
    act(() => tree.root.findByType(TextInput).props.onChangeText('coffee'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    return tree;
  }

  it('says how many entries matched', async () => {
    const tree = await searchFor([
      entry('a', '2026-03-04'),
      entry('b', '2026-03-03'),
      entry('c', '2026-03-03'),
    ]);
    expect(texts(tree)).toContain('3 matches');
    act(() => tree.unmount());
    const one = await searchFor([entry('a', '2026-03-04')]);
    expect(texts(one)).toContain('1 match');
  });

  it('shows the newest 50 and says there are more, when more matched', async () => {
    const { SearchStatus } = require('./ActivityFilterChips');
    const rows = Array.from({ length: 51 }, (_, i) => entry(`e${i}`, '2026-03-04'));
    const tree = await searchFor(rows);
    expect(tree.root.findByType(SearchStatus).props.resultCount).toBe(50);
    expect(texts(tree)).toContain('Newest 50 matches. Add a word to narrow it.');
  });

  it('names the year of a result that is not from this year, since search spans the whole ledger', async () => {
    const { dayMonth, dayMonthYear } = require('@/lib/dateLabels');
    const year = new Date().getFullYear();
    const tree = await searchFor([entry('now', `${year}-01-05`), entry('old', `${year - 2}-03-04`)]);
    const shown = texts(tree);
    // Each result's day is named in its heading ("5 Jan · Monday"); a result from another year says the year.
    expect(shown.some((t) => t.startsWith(`${dayMonth(`${year}-01-05`)} · `))).toBe(true);
    expect(shown.some((t) => t.startsWith(`${dayMonthYear(`${year - 2}-03-04`)} · `))).toBe(true);
  });
});

describe('Activity page states', () => {
  it('names a past period when it is empty, instead of calling it "this week"', async () => {
    mockComparison.fail = false;
    const tree = await render();
    expect(texts(tree)).toContain('Nothing logged this week');
    const back = tree.root.findAll(
      (n) => n.props.accessibilityLabel === 'Previous week' && typeof n.props.onPress === 'function'
    )[0];
    await act(async () => back.props.onPress());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const shown = texts(tree);
    expect(shown.some((t) => t.startsWith('Nothing logged in '))).toBe(true);
    expect(shown).not.toContain('Nothing logged this week');
  });

  it('fades a period’s days in as they land, so they follow the Spent strip instead of snapping', async () => {
    const { toLocalIsoDate } = require('@/lib/date');
    mockComparison.fail = false;
    mockLedger.transactions = [
      {
        id: 'e1',
        type: 'expense',
        accountId: 'bank',
        categoryId: null,
        amountMinor: 10000,
        date: toLocalIsoDate(new Date()),
        note: '',
      },
    ] as Transaction[];
    const tree = await render();
    const day = tree.root.findAll((n) => typeof n.props.date === 'string' && Array.isArray(n.props.items))[0];
    expect(day.props.entering).toBeDefined();
  });

  it('shows an expense label as a chip in the filter row, removable like the others', async () => {
    const { FilterModal } = require('./FilterModal');
    const { ActivityFilterChips } = require('./ActivityFilterChips');
    mockComparison.fail = false;
    const tree = await render();
    act(() =>
      tree.root
        .findByType(FilterModal)
        .props.onApply({ type: 'all', categoryIds: [], accountIds: [], expenseLabel: 'Lunch' })
    );
    expect(tree.root.findByType(ActivityFilterChips).props.expenseLabel).toBe('Lunch');
    expect(texts(tree)).toContain('Label: Lunch');
    const press = (label: string) =>
      tree.root
        .findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0]
        .props.onPress();
    // It counts as a picked filter, so Clear all is offered with it.
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === 'Clear all Activity filters')
    ).not.toHaveLength(0);
    act(() => press('Remove expense label filter'));
    expect(tree.root.findByType(ActivityFilterChips).props.expenseLabel).toBeUndefined();
    expect(texts(tree).some((t) => t.startsWith('Label:'))).toBe(false);
  });
});

describe('Activity search and the back button', () => {
  it('closes search instead of leaving the tab, and lets back through when search is closed', async () => {
    const { HeaderIconButton } = require('@/components/AppHeader');
    const remove = jest.fn();
    const add = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
    try {
      mockComparison.fail = false;
      const tree = await render();
      expect(add).not.toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
      const action = (label: string) =>
        tree.root.findAllByType(HeaderIconButton).find((n) => n.props.label === label);
      act(() => action('Search transactions')!.props.onPress());
      const registered = add.mock.calls.filter(([name]) => name === 'hardwareBackPress');
      expect(registered.length).toBeGreaterThan(0);
      const handler = registered[registered.length - 1][1] as () => boolean;
      let handled = false;
      act(() => {
        handled = handler();
      });
      // Back was taken (it did not leave), and search is closed again.
      expect(handled).toBe(true);
      expect(action('Search transactions')).toBeDefined();
      expect(action('Close search')).toBeUndefined();
      // The listener goes with the search it belonged to.
      expect(remove).toHaveBeenCalled();
    } finally {
      add.mockRestore();
    }
  });
});

describe('Activity opened on a month from a link', () => {
  const selectedScope = (tree: ReactTestRenderer) => [
    ...new Set(
      tree.root
        .findAll(
          (n) =>
            n.props.accessibilityRole === 'radio' &&
            n.props.accessibilityState?.selected &&
            typeof n.props.onPress === 'function'
        )
        .flatMap((n) => n.findAllByType(Text).map((t) => t.props.children))
        .filter((l) => l === 'Week' || l === 'Month')
    ),
  ];

  it('opens a past month on its own (Home’s View all), with the filters clear', async () => {
    const { router } = require('expo-router');
    mockComparison.fail = false;
    const past = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);
    mockParams = { month: `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}` };
    const tree = await render();
    expect(selectedScope(tree)).toEqual(['Month']);
    expect(texts(tree)).toContain(past.toLocaleDateString(undefined, { month: 'long' }));
    // The link is spent: it does not reopen that month the next time Activity is shown.
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ month: undefined }));
  });

  it('ignores a month that is not real or not yet here, and stays on this week', async () => {
    const { router } = require('expo-router');
    mockComparison.fail = false;
    for (const month of ['2999-01', '2026-13', 'nonsense']) {
      router.setParams.mockClear();
      mockParams = { month };
      const tree = await render();
      expect(selectedScope(tree)).toEqual(['Week']);
      expect(texts(tree)).toContain('This week');
      expect(router.setParams).toHaveBeenCalledWith({ month: undefined });
      act(() => tree.unmount());
      mounted = null;
    }
  });
});

it('does not redraw the screen when its days have finished arriving', async () => {
  // The days that mount as a period lands fade in for a moment. Turning that off again once was a state change: a
  // redraw of the whole screen, with nothing on it different, after every period step.
  mockComparison.fail = false;
  const { toLocalIsoDate } = require('@/lib/date');
  mockLedger.transactions = [
    {
      id: 'tea',
      type: 'expense',
      accountId: 'bank',
      categoryId: null,
      amountMinor: 2900,
      date: toLocalIsoDate(new Date()),
      note: 'Tea',
    },
  ] as Transaction[];
  let commits = 0;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <Profiler id="activity" onRender={() => commits++}>
        <TransactionsScreen />
      </Profiler>
    );
  });
  mounted = tree;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(texts(tree)).toContain('Tea');
  const settled = commits;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  expect(commits).toBe(settled);
});
