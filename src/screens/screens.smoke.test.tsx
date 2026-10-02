/**
 * Every route screen, opened the way a real person meets it: a brand-new
 * install with nothing in it, then a lived-in phone (several accounts, a
 * loan, a budget, a goal, a recurring rule, a friend ledger, refunds, a
 * transfer to savings, entries in earlier months), with amounts shown and
 * with amounts hidden. A screen that throws, shows the crash fallback or
 * prints NaN / undefined / [object Object] fails here — on a real SQLite
 * engine running the app's real queries.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { createRealDataTestDb, AsyncDb } from '@/test-support/realDataTestDb';

// The first screen of each kind pays for loading its whole module tree; on a cold cache under a full run that can be slow.
jest.setTimeout(90000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({
  getDb: async () => mockDb,
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn(), select: jest.fn() },
}));
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
  scheduleLoanDueReminder: async () => {},
  cancelLoanDueReminder: async () => {},
}));

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react-native').ScrollView,
  KeyboardStickyView: require('react-native').View,
  KeyboardProvider: ({ children }: { children: unknown }) => children,
}));

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const React = require('react');
  const noop = () => {};
  return {
    router: { push: noop, back: noop, replace: noop, navigate: noop, canGoBack: () => true, setParams: noop },
    useRouter: () => ({ push: noop, back: noop, replace: noop, navigate: noop, canGoBack: () => true }),
    useLocalSearchParams: () => mockParams,
    useGlobalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    useNavigation: () => ({ setOptions: noop, addListener: () => noop, goBack: noop }),
    useSegments: () => [],
    usePathname: () => '/',
    Stack: Object.assign(() => null, { Screen: () => null }),
    Tabs: Object.assign(() => null, { Screen: () => null }),
    Link: ({ children }: { children: unknown }) => children,
    Redirect: () => null,
  };
});
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    useSafeAreaInsets: () => inset,
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
    SafeAreaView: ({ children }: { children: unknown }) => children,
  };
});
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHide, toggleHideAmounts: jest.fn() }),
  PrivacyProvider: ({ children }: { children: unknown }) => children,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { createBudget } from '@/db/budgets';
import { createSavingsGoal, contributeToGoal } from '@/db/savingsGoals';
import { createRecurringRule } from '@/db/recurring';
import { archiveAccount } from '@/db/accounts';
import { archiveCategory } from '@/db/categories';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';
import { createLoan } from '@/db/loanRecords';
import { createPerson, addLedgerEntry } from '@/db/people';
import { setDefaultCurrency, setUserName, setHasOnboarded } from '@/db/settings';
import { UndoToastProvider } from '@/components/UndoToast';
import { toLocalIsoDate } from '@/lib/date';

const SCREENS: [string, () => { default: React.ComponentType }][] = [
  ['home', () => require('../../app/(tabs)/index')],
  ['activity', () => require('../../app/(tabs)/transactions')],
  ['add', () => require('../../app/add-transaction')],
  ['plan', () => require('../../app/(tabs)/plan')],
  ['reports', () => require('../../app/(tabs)/reports')],
  ['profile', () => require('../../app/profile')],
  ['backup', () => require('../../app/backup')],
  ['budgets', () => require('../../app/budgets')],
  ['categories', () => require('../../app/categories')],
  ['category detail', () => require('../../app/category/[id]')],
  ['garden', () => require('../../app/garden')],
  ['loans', () => require('../../app/loans')],
  ['notification settings', () => require('../../app/notification-settings')],
  ['notifications', () => require('../../app/notifications')],
  ['people', () => require('../../app/people')],
  ['recently deleted', () => require('../../app/recently-deleted')],
  ['recurring', () => require('../../app/recurring')],
  ['savings goals', () => require('../../app/savings-goals')],
  ['split', () => require('../../app/split')],
  ['themes', () => require('../../app/themes')],
  ['tidy up', () => require('../../app/tidy-up')],
  ['what if', () => require('../../app/whatif')],
  ['wrap', () => require('../../app/wrap')],
];

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalIsoDate(d);
};
const monthsAgo = (n: number, day = 5) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return toLocalIsoDate(d);
};

async function freshDb() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await setDefaultCurrency('INR');
}

let seededCategoryId = '';
async function livedIn() {
  await freshDb();
  await setUserName('Tester');
  await setHasOnboarded(true);
  const bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 5_000_000 })
  ).id;
  const cash = (
    await createAccount({ name: 'Cash', type: 'cash', currency: 'INR', openingBalanceMinor: 200_000 })
  ).id;
  const pot = (
    await createAccount({ name: 'Pot', type: 'savings', currency: 'INR', openingBalanceMinor: 1_000_000 })
  ).id;
  const card = (
    await createAccount({
      name: 'Card',
      type: 'credit_card',
      currency: 'INR',
      openingBalanceMinor: 0,
      creditLimitMinor: 10_000_000,
      statementDay: 5,
      dueDay: 25,
    })
  ).id;
  const salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
  const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  const rent = (await createCategory({ name: 'Rent', kind: 'expense' })).id;
  const stocks = (await createCategory({ name: 'Stocks', kind: 'expense', isSensitive: true })).id;
  seededCategoryId = food;

  for (let m = 5; m >= 0; m--) {
    await createTransaction({
      type: 'income',
      accountId: bank,
      categoryId: salary,
      amountMinor: 8_000_000,
      date: monthsAgo(m, 1),
    });
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: rent,
      amountMinor: 2_500_000,
      date: monthsAgo(m, 3),
    });
    await createTransaction({
      type: 'expense',
      accountId: cash,
      categoryId: food,
      amountMinor: 120_000 + m * 1000,
      date: monthsAgo(m, 9),
      note: 'Lunch',
    });
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: stocks,
      amountMinor: 300_000,
      date: monthsAgo(m, 12),
    });
  }
  await createTransaction({
    type: 'expense',
    accountId: card,
    categoryId: food,
    amountMinor: 450_000,
    date: daysAgo(2),
    note: 'Dinner',
  });
  await createTransaction({
    type: 'income',
    accountId: bank,
    categoryId: food,
    amountMinor: 50_000,
    date: daysAgo(1),
    isRefund: true,
  });
  await createTransaction({
    type: 'transfer',
    accountId: bank,
    toAccountId: pot,
    amountMinor: 500_000,
    date: daysAgo(4),
  });
  await createTransaction({
    type: 'expense',
    accountId: cash,
    categoryId: food,
    amountMinor: 25_000,
    date: daysAgo(0),
    note: 'Tea',
  });

  await createBudget({ categoryId: food, limitAmountMinor: 600_000, rollover: true });
  await createSavingsGoal({
    name: 'Trip',
    targetAmountMinor: 5_000_000,
    targetDate: null,
    linkedAccountId: pot,
    tracksAccount: true,
  });
  await createSavingsGoal({
    name: 'Phone',
    targetAmountMinor: 3_000_000,
    targetDate: monthsAgo(-6),
    linkedAccountId: null,
  });
  await createRecurringRule({
    type: 'expense',
    accountId: bank,
    categoryId: rent,
    amountMinor: 2_500_000,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: daysAgo(-3),
  });
  await createLoan({
    direction: 'borrowed',
    counterparty: 'Home bank',
    principalMinor: 20_000_000,
    interestRateAnnualBp: 850,
    tenureMonths: 120,
    startDate: monthsAgo(8, 10),
    linkedAccountId: bank,
  });
  const friend = await createPerson({ name: 'Asha' });
  await addLedgerEntry({
    personId: friend.id,
    accountId: bank,
    direction: 'gave',
    amountMinor: 100_000,
    date: daysAgo(6),
  } as never);
}

const LONG = 'Very long name '.repeat(14);

async function awkward() {
  await freshDb();
  const bank = (await createAccount({ name: LONG, type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const usd = (
    await createAccount({ name: 'Dollar', type: 'bank', currency: 'USD', openingBalanceMinor: 123_456 })
  ).id;
  const old = (
    await createAccount({ name: 'Old wallet', type: 'cash', currency: 'INR', openingBalanceMinor: 1000 })
  ).id;
  const pot = (await createAccount({ name: 'Pot', type: 'savings', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const income = (await createCategory({ name: 'Pay', kind: 'income' })).id;
  const food = (await createCategory({ name: LONG, kind: 'expense' })).id;
  const gone = (await createCategory({ name: 'Retired', kind: 'expense' })).id;
  const emoji = (await createCategory({ name: 'Café ☕ العربية', kind: 'expense' })).id;
  seededCategoryId = food;
  const tx = createTransaction;

  await tx({
    type: 'expense',
    accountId: bank,
    categoryId: food,
    amountMinor: 1,
    date: daysAgo(0),
    note: "x'); DROP TABLE transactions;-- " + LONG,
  });
  await tx({
    type: 'expense',
    accountId: bank,
    categoryId: emoji,
    amountMinor: MAX_AMOUNT_MINOR,
    date: daysAgo(1),
  });
  await tx({
    type: 'income',
    accountId: bank,
    categoryId: income,
    amountMinor: MAX_AMOUNT_MINOR,
    date: daysAgo(1),
  });
  await tx({ type: 'expense', accountId: usd, categoryId: food, amountMinor: 5_000, date: daysAgo(2) });
  await tx({ type: 'expense', accountId: old, categoryId: gone, amountMinor: 200, date: monthsAgo(2) });
  await tx({ type: 'expense', accountId: bank, categoryId: food, amountMinor: 10_000, date: '2000-01-01' });
  await tx({ type: 'expense', accountId: bank, categoryId: food, amountMinor: 10_000, date: '2099-12-31' });
  await tx({ type: 'expense', accountId: bank, categoryId: food, amountMinor: 10_000, date: '2024-02-29' });
  // A refund bigger than anything spent on that category this month.
  await tx({
    type: 'income',
    accountId: bank,
    categoryId: food,
    amountMinor: 900_000,
    date: daysAgo(0),
    isRefund: true,
  });
  await tx({ type: 'transfer', accountId: bank, toAccountId: pot, amountMinor: 700_000, date: daysAgo(0) });
  await archiveAccount(old);
  await archiveCategory(gone);

  await createBudget({ categoryId: food, limitAmountMinor: 100, rollover: true });
  await createBudget({ categoryId: emoji, limitAmountMinor: 100_000, rollover: false });
  const over = await createSavingsGoal({
    name: LONG,
    targetAmountMinor: 1000,
    targetDate: monthsAgo(3),
    linkedAccountId: null,
  });
  await contributeToGoal(over.id, 999_999);
  await createSavingsGoal({
    name: 'Tracks pot',
    targetAmountMinor: 100,
    targetDate: null,
    linkedAccountId: pot,
    tracksAccount: true,
  });
  await createRecurringRule({
    type: 'expense',
    accountId: bank,
    categoryId: food,
    amountMinor: 100,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: '2026-01-31',
    endDate: monthsAgo(2),
  });
  await createLoan({
    direction: 'borrowed',
    counterparty: 'Zero rate',
    principalMinor: 100_000,
    interestRateAnnualBp: 0,
    tenureMonths: 1,
    startDate: monthsAgo(3),
    linkedAccountId: bank,
  });
  await createLoan({
    direction: 'lent',
    counterparty: LONG,
    principalMinor: 5_000_000,
    interestRateAnnualBp: 1200,
    tenureMonths: 24,
    startDate: monthsAgo(1),
    linkedAccountId: bank,
  });
  await createLoan({
    direction: 'borrowed',
    counterparty: 'Paid off',
    principalMinor: 300_000,
    interestRateAnnualBp: 1000,
    tenureMonths: 3,
    startDate: monthsAgo(4),
    linkedAccountId: bank,
    alreadyPaidInstallments: 3,
  });
  const p1 = await createPerson({ name: LONG });
  await addLedgerEntry({ personId: p1.id, amountMinor: 100, date: daysAgo(1) });
  await addLedgerEntry({ personId: p1.id, amountMinor: -100, date: daysAgo(0) });
  const p2 = await createPerson({ name: 'I owe' });
  await addLedgerEntry({ personId: p2.id, amountMinor: -250_000, date: daysAgo(3) });
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });
  }
}

function textOf(tree: ReactTestRenderer): string {
  return tree.root
    .findAllByType(Text)
    .map((n) =>
      [n.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join('')
    )
    .join(' | ');
}

const BAD = [/NaN/, /undefined/, /\[object Object\]/, /-?Infinity(?! Glow)/];

function expectHealthy(name: string, tree: ReactTestRenderer) {
  const text = textOf(tree);
  expect({ name, crashed: text.includes('Something went wrong') }).toEqual({ name, crashed: false });
  for (const bad of BAD) {
    const m = bad.exec(text);
    expect({
      name,
      bad: String(bad),
      near: m ? text.slice(Math.max(0, m.index - 40), m.index + 40) : null,
    }).toEqual({
      name,
      bad: String(bad),
      near: null,
    });
  }
}

async function open(load: () => { default: React.ComponentType }) {
  const Screen = load().default;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <UndoToastProvider>
        <Screen />
      </UndoToastProvider>
    );
  });
  await settle();
  return tree;
}

describe('every screen on a brand-new install', () => {
  beforeEach(async () => {
    mockHide = false;
    mockParams = {};
    await freshDb();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(SCREENS)('%s opens with nothing in it', async (name, load) => {
    const tree = await open(load);
    expectHealthy(name, tree);
    act(() => tree.unmount());
  });
});

describe('every screen on a lived-in phone', () => {
  beforeAll(async () => {
    await livedIn();
  });
  beforeEach(() => {
    mockHide = false;
    mockParams = { id: seededCategoryId };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(SCREENS)('%s shows real figures', async (name, load) => {
    const tree = await open(load);
    expectHealthy(name, tree);
    act(() => tree.unmount());
  });

  it.each(SCREENS)('%s with amounts hidden', async (name, load) => {
    mockHide = true;
    const tree = await open(load);
    expectHealthy(name, tree);
    act(() => tree.unmount());
  });
});

describe('every screen on a phone full of awkward data', () => {
  beforeAll(async () => {
    await awkward();
  });
  beforeEach(() => {
    mockHide = false;
    mockParams = { id: seededCategoryId };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(SCREENS)('%s copes', async (name, load) => {
    const tree = await open(load);
    expectHealthy(name, tree);
    act(() => tree.unmount());
  });

  it.each(SCREENS)('%s copes with amounts hidden', async (name, load) => {
    mockHide = true;
    const tree = await open(load);
    expectHealthy(name, tree);
    act(() => tree.unmount());
  });
});

describe('Home, stepping between months on a lived-in phone', () => {
  const press = async (tree: ReactTestRenderer, label: string) => {
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')
        .props.onPress();
    });
  };

  beforeAll(async () => {
    await livedIn();
  });
  beforeEach(() => {
    mockHide = false;
    mockParams = {};
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('never shows a back month with this month’s bills, and carries the right leftover into it', async () => {
    const { getCarryInMinor, getPeriodSummary } = require('@/db/reports');
    const { formatMoney } = require('@/lib/money');
    const now = new Date();
    const first = (back: number) => toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() - back, 1));
    const last = (back: number) => toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() - back + 1, 0));
    const carry = await getCarryInMinor(first(1));
    const lastMonth = await getPeriodSummary({ start: first(1), end: last(1) });

    const tree = await open(SCREENS[0][1]);
    expect(textOf(tree)).toContain('This month');
    expect(textOf(tree)).toContain('still to pay');

    await act(async () => {
      tree.root
        .find(
          (n) => n.props.accessibilityLabel === 'Previous period' && typeof n.props.onPress === 'function'
        )
        .props.onPress();
    });
    // Mid-switch: whichever month is on screen, the title and the bills agree.
    const mid = textOf(tree);
    expect(mid.includes('Looking back') && mid.includes('still to pay')).toBe(false);
    await settle();

    const back = textOf(tree);
    expect(back).toContain('Looking back');
    expect(back).not.toContain('still to pay');
    expect(back).not.toContain('Short after bills');
    expect(back).toContain(`+ ${formatMoney(carry)} carried over`);
    expect(back).toContain(`of ${formatMoney(lastMonth.incomeMinor)} income`);

    await press(tree, 'Next period');
    await settle();
    const again = textOf(tree);
    expect(again).toContain('This month');
    expect(again).toContain('still to pay');
    act(() => tree.unmount());
  });

  it('keeps the accounts on screen while stepping, instead of blanking them', async () => {
    const tree = await open(SCREENS[0][1]);
    expect(textOf(tree)).toContain('Bank');
    for (let i = 0; i < 4; i++) {
      await press(tree, 'Previous period');
      expect(textOf(tree)).toContain('Your accounts');
      expect(textOf(tree)).toContain('Bank');
    }
    await settle();
    expect(textOf(tree)).toContain('Bank');
    for (let i = 0; i < 4; i++) await press(tree, 'Next period');
    await settle();
    expect(textOf(tree)).toContain('This month');
    expect(textOf(tree)).toContain('Bank');
    act(() => tree.unmount());
  });

  it('lands on the last month asked for when stepped quickly', async () => {
    const tree = await open(SCREENS[0][1]);
    await act(async () => {
      for (let i = 0; i < 3; i++) {
        tree.root
          .find(
            (n) => n.props.accessibilityLabel === 'Previous period' && typeof n.props.onPress === 'function'
          )
          .props.onPress();
      }
    });
    await settle();
    const text = textOf(tree);
    expect(text).toContain('Looking back');
    act(() => tree.unmount());
  });
});
