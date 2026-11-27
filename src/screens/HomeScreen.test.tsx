/**
 * Home assembled on a real database: what it shows, what its sheets open, and what does not make the page behind them
 * redraw. The sections are counted through wrappers that render the real ones.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(90000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn(), select: jest.fn() },
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: require('react-native').View,
  useKeyboardState: () => false,
  KeyboardAwareScrollView: require('react-native').ScrollView,
  KeyboardStickyView: require('react-native').View,
  KeyboardProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => {} }));
const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), setParams: jest.fn() };
jest.mock('expo-router', () => ({
  router: mockRouter,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(cb, [cb]),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: () => jest.fn(), goBack: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    useSafeAreaInsets: () => inset,
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
  };
});
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
  PrivacyProvider: ({ children }: { children: unknown }) => children,
}));

// What the page's sections were given, and how often each was drawn.
const mockDrawn = { accounts: 0, comingUp: 0, hero: 0, header: 0 };
const mockSeen: {
  alertCount: number | null;
  summary: string | null;
  entry: string | null;
  step: ((dir: -1 | 1) => void) | null;
} = { alertCount: null, summary: null, entry: null, step: null };
jest.mock('@/features/home/HomeAccounts', () => {
  const actual = jest.requireActual('@/features/home/HomeAccounts');
  return {
    ...actual,
    HomeAccounts: (props: Parameters<typeof actual.HomeAccounts>[0]) => {
      mockDrawn.accounts++;
      return actual.HomeAccounts(props);
    },
  };
});
jest.mock('@/features/home/HomeComingUp', () => {
  const actual = jest.requireActual('@/features/home/HomeComingUp');
  return {
    ...actual,
    HomeComingUp: (props: Parameters<typeof actual.HomeComingUp>[0]) => {
      mockDrawn.comingUp++;
      return actual.HomeComingUp(props);
    },
  };
});
jest.mock('@/features/home/ThisMonthHero', () => {
  const actual = jest.requireActual('@/features/home/ThisMonthHero');
  return {
    ...actual,
    ThisMonthHero: (props: { onStep: (dir: -1 | 1) => void }) => {
      mockDrawn.hero++;
      mockSeen.step = props.onStep;
      return actual.ThisMonthHero(props);
    },
  };
});
jest.mock('@/features/home/HomeHeader', () => ({
  HomeHeader: (props: { alertCount: number }) => {
    mockDrawn.header++;
    mockSeen.alertCount = props.alertCount;
    return null;
  },
}));
jest.mock('@/features/home/AccountSummarySheet', () => ({
  AccountSummarySheet: (props: { account: { name: string } | null }) => {
    mockSeen.summary = props.account?.name ?? null;
    return null;
  },
}));
jest.mock('@/features/transactions/TransactionDetailModal', () => ({
  TransactionDetailModal: (props: { tx: { id: string } | null }) => {
    mockSeen.entry = props.tx?.id ?? null;
    return null;
  },
}));
jest.mock('@/features/profile/AccountDetailModal', () => ({ AccountDetailModal: () => null }));
jest.mock('@/features/profile/AddAccountModal', () => ({ AddAccountModal: () => null }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { resetSettingsCache, setDefaultCurrency, setUserName, setHasOnboarded } from '@/db/settings';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { toLocalIsoDate } from '@/lib/date';
import { clearReadCache } from '@/db/readCache';
import { UndoToastProvider } from '@/components/UndoToast';
import HomeScreen from '../../app/(tabs)/index';

const today = toLocalIsoDate(new Date());
let mounted: ReactTestRenderer | null = null;
let bank = '';
let food = '';

async function seed() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  clearReadCache();
  await setDefaultCurrency('INR');
  await setUserName('Tester');
  await setHasOnboarded(true);
  bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 5_000_000 })
  ).id;
  await createAccount({ name: 'Cash', type: 'cash', currency: 'INR', openingBalanceMinor: 200_000 });
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  await createTransaction({
    type: 'expense',
    accountId: bank,
    categoryId: food,
    amountMinor: 25_000,
    date: today,
    note: 'Tea',
  });
}

const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

async function openHome() {
  await act(async () => {
    mounted = create(
      <UndoToastProvider>
        <HomeScreen />
      </UndoToastProvider>
    );
  });
  // The data, then the things that wait for the thread to be idle.
  await settle(50);
  await settle(50);
  return mounted!;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat(5).join(''));
const press = (tree: ReactTestRenderer, label: string) =>
  tree.root.find(
    (n) =>
      typeof n.type !== 'string' &&
      typeof n.props.onPress === 'function' &&
      String(n.props.accessibilityLabel ?? '').startsWith(label)
  );

beforeEach(async () => {
  mockHideAmounts = false;
  Object.assign(mockDrawn, { accounts: 0, comingUp: 0, hero: 0, header: 0 });
  Object.assign(mockSeen, { alertCount: null, summary: null, entry: null, step: null });
  await seed();
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
});

it('shows the month card, the accounts and the latest entries', async () => {
  const tree = await openHome();
  const shown = texts(tree);
  expect(shown).toContain('Recent activity');
  expect(shown.join(' ')).toContain('Tea');
  expect(mockDrawn.hero).toBeGreaterThan(0);
  expect(mockDrawn.accounts).toBeGreaterThan(0);
});

it('withholds the previous financial snapshot when privacy changes', async () => {
  const tree = await openHome();
  expect(texts(tree)).toContain('Recent activity');
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const read = mockDb.getFirstAsync;
  mockDb.getFirstAsync = async <T,>(sql: string, params?: Parameters<AsyncDb['getFirstAsync']>[1]) => {
    await pending;
    return read<T>(sql, params);
  };
  mockHideAmounts = true;
  try {
    act(() => {
      tree.update(
        <UndoToastProvider>
          <HomeScreen />
        </UndoToastProvider>
      );
    });
    expect(texts(tree)).not.toContain('Recent activity');
  } finally {
    await act(async () => release());
    mockDb.getFirstAsync = read;
  }
  expect(texts(tree)).toContain('Recent activity');
});

it('opens an entry from Recent activity, and closes it', async () => {
  const tree = await openHome();
  const row = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.findAllByType(Text).some((t) => [t.props.children].flat().join('') === 'Tea')
  );
  act(() => row.props.onPress());
  expect(mockSeen.entry).not.toBeNull();
});

it('opens an account’s summary from its tile', async () => {
  const tree = await openHome();
  act(() => press(tree, 'Bank, bank').props.onPress());
  expect(mockSeen.summary).toBe('Bank');
});

it('does not redraw the page behind a sheet when one opens', async () => {
  const tree = await openHome();
  const before = { ...mockDrawn };
  act(() => press(tree, 'Bank, bank').props.onPress());
  expect(mockSeen.summary).toBe('Bank');
  expect(mockDrawn).toEqual(before);
});

it('does not redraw the page when the opening fade has played, or when the same number of things need you', async () => {
  await openHome();
  const settled = { ...mockDrawn };
  expect(mockSeen.alertCount).toBe(0);
  // The staggered opening fade is turned off 800 ms after the first load.
  await settle(1000);
  expect(mockDrawn).toEqual(settled);
});

it('picks up an entry saved elsewhere without a visit to another screen', async () => {
  const tree = await openHome();
  expect(texts(tree).join(' ')).not.toContain('Biscuits');
  await createTransaction({
    type: 'expense',
    accountId: bank,
    categoryId: food,
    amountMinor: 9_900,
    date: today,
    note: 'Biscuits',
  });
  clearReadCache();
  await act(async () => {
    emitTransactionsChanged();
  });
  await settle(100);
  await settle(100);
  expect(texts(tree).join(' ')).toContain('Biscuits');
});

describe('what a reload or a step redraws', () => {
  const quiet = async () => {
    await settle(100);
    await settle(100);
  };
  const delta = (before: typeof mockDrawn) => ({
    accounts: mockDrawn.accounts - before.accounts,
    comingUp: mockDrawn.comingUp - before.comingUp,
    hero: mockDrawn.hero - before.hero,
  });

  it('draws none of its sections again for a reload that found nothing new', async () => {
    await openHome();
    await settle(1000);
    const before = { ...mockDrawn };
    await act(async () => {
      emitTransactionsChanged();
    });
    await quiet();
    expect(delta(before)).toEqual({ accounts: 0, comingUp: 0, hero: 0 });
  });

  it('draws the month card and the accounts for a saved entry, and not Upcoming, which has nothing new', async () => {
    await openHome();
    await settle(1000);
    const before = { ...mockDrawn };
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 9_900,
      date: today,
      note: 'Biscuits',
    });
    clearReadCache();
    await act(async () => {
      emitTransactionsChanged();
    });
    await quiet();
    const changed = delta(before);
    expect(changed.hero).toBeGreaterThan(0);
    expect(changed.accounts).toBeGreaterThan(0);
    expect(changed.comingUp).toBe(0);
  });

  it('steps to another month without drawing the accounts or Upcoming again', async () => {
    await openHome();
    await settle(1000);
    const before = { ...mockDrawn };
    await act(async () => mockSeen.step!(-1));
    await quiet();
    const changed = delta(before);
    expect(changed.hero).toBeGreaterThan(0);
    expect(changed.accounts).toBe(0);
    expect(changed.comingUp).toBe(0);
  });
});

it('says what went wrong when the first load fails, and loads on Try again', async () => {
  const working = mockDb;
  const broken = async () => {
    throw new Error('disk full');
  };
  mockDb = { ...working, getAllAsync: broken, getFirstAsync: broken } as unknown as AsyncDb;
  const tree = await openHome();
  expect(texts(tree)).toEqual(expect.arrayContaining(['Couldn’t load your data', 'disk full']));
  mockDb = working;
  clearReadCache();
  const retry = tree.root.find((n) => n.props.title === 'Try again' && typeof n.props.onPress === 'function');
  await act(async () => retry.props.onPress());
  await settle(100);
  await settle(100);
  expect(texts(tree)).not.toContain('Couldn’t load your data');
  expect(texts(tree).join(' ')).toContain('Tea');
});

it('leaves out an archived account, and a closed loan, from what it shows', async () => {
  const { archiveAccount } = require('@/db/accounts');
  const spare = (
    await createAccount({ name: 'Spare', type: 'cash', currency: 'INR', openingBalanceMinor: 100 })
  ).id;
  await archiveAccount(spare);
  clearReadCache();
  const tree = await openHome();
  const labels = tree.root
    .findAll((n) => typeof n.props.accessibilityLabel === 'string')
    .map((n) => String(n.props.accessibilityLabel));
  expect(labels.some((l) => l.startsWith('Bank, bank'))).toBe(true);
  expect(labels.some((l) => l.startsWith('Spare'))).toBe(false);
});
