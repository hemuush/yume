/**
 * Every route screen opened as a person meets it: a fresh install, then a lived-in phone, with amounts shown
 * and hidden. A screen that throws, shows the crash fallback or prints NaN/undefined/[object Object] fails.
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
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react-native').ScrollView,
  KeyboardStickyView: require('react-native').View,
  KeyboardProvider: ({ children }: { children: unknown }) => children,
}));

jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => {} }));

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
import { createRecurringRule, runDueRecurringRules } from '@/db/recurring';
import { archiveAccount } from '@/db/accounts';
import { archiveCategory } from '@/db/categories';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';
import { createLoan } from '@/db/loanRecords';
import { createPerson, addLedgerEntry } from '@/db/people';
import { resetSettingsCache, setDefaultCurrency, setUserName, setHasOnboarded } from '@/db/settings';
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
  resetSettingsCache();
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
  const friend = await createPerson({ name: 'Test friend' });
  await addLedgerEntry({
    personId: friend.id,
    amountMinor: 100_000, // positive: they owe the user
    date: daysAgo(6),
  });
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

describe('re-audit recurring privacy and currency regressions', () => {
  beforeEach(async () => {
    mockHide = false;
    mockParams = {};
    await freshDb();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each(['home', 'plan', 'recurring'])(
    '%s keeps archived sensitive recurring amounts out of visible and spoken output',
    async (name) => {
      const bank = await createAccount({
        name: 'Bank',
        type: 'bank',
        currency: 'INR',
        openingBalanceMinor: 0,
      });
      const parent = await createCategory({ name: 'Private parent', kind: 'expense', isSensitive: true });
      const child = await createCategory({ name: 'Private child', kind: 'expense', parentId: parent.id });
      const publicCategory = await createCategory({ name: 'Public bill', kind: 'expense' });
      for (const [categoryId, amountMinor] of [
        [child.id, 9876500],
        [publicCategory.id, 12300],
      ] as const) {
        await createRecurringRule({
          type: 'expense',
          accountId: bank.id,
          categoryId,
          amountMinor,
          frequency: 'monthly',
          intervalCount: 1,
          nextRunDate: toLocalIsoDate(new Date()),
        });
      }
      await archiveCategory(parent.id);
      mockHide = true;
      const tree = await open(SCREENS.find(([key]) => key === name)![1]);
      try {
        expectHealthy(name, tree);
        expect(textOf(tree)).toContain('₹123');
        expect(textOf(tree)).not.toContain('₹98,765');
        const spoken = tree.root
          .findAll((n) => typeof n.props.accessibilityLabel === 'string')
          .map((n) => n.props.accessibilityLabel)
          .join(' | ');
        expect(spoken).not.toContain('₹98,765');
      } finally {
        act(() => tree.unmount());
      }
    }
  );

  it.each(['home', 'plan', 'recurring'])(
    '%s scopes recurring summaries and upcoming calculations to INR',
    async (name) => {
      const category = await createCategory({ name: 'Subscription', kind: 'expense' });
      const ruleIds: Record<string, string> = {};
      for (const currency of ['INR', 'USD']) {
        const bank = await createAccount({ name: currency, type: 'bank', currency, openingBalanceMinor: 0 });
        const r = await createRecurringRule({
          type: 'expense',
          accountId: bank.id,
          categoryId: category.id,
          amountMinor: 10000,
          frequency: 'monthly',
          intervalCount: 1,
          nextRunDate: toLocalIsoDate(new Date()),
        });
        ruleIds[currency] = r.id;
      }
      const tree = await open(SCREENS.find(([key]) => key === name)![1]);
      try {
        expectHealthy(name, tree);
        if (name === 'recurring') {
          const { RecurringHero } = require('@/features/recurring/RecurringHero');
          expect(tree.root.findByType(RecurringHero).props.totals).toEqual({
            monthlyMinor: 10000,
            yearlyMinor: 120000,
            count: 1,
          });
          expect(textOf(tree)).toContain('$100');
          expect(textOf(tree)).toContain('Summary and timeline in INR');
        } else if (name === 'home') {
          const { HomeGlance } = require('@/features/home/HomeGlance');
          expect(
            tree.root.findByType(HomeGlance).props.upcoming.items.map((i: { key: string }) => i.key)
          ).toEqual([ruleIds.INR]);
        } else {
          const { RunwayCard } = require('@/features/plan/RunwayCard');
          expect(tree.root.findByType(RunwayCard).props.dueSoon.totalMinor).toBe(10000);
          expect(tree.root.findByType(RunwayCard).props.runway.endMinor).toBe(-10000);
        }
      } finally {
        act(() => tree.unmount());
      }
    }
  );

  it('Plan carries the posting engine’s original month-end anchor into its forecast', async () => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout'] });
    jest.setSystemTime(new Date(2026, 1, 28, 12));
    const bank = await createAccount({
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 25000,
    });
    const category = await createCategory({ name: 'Month-end bill', kind: 'expense' });
    await createRecurringRule({
      type: 'expense',
      accountId: bank.id,
      categoryId: category.id,
      amountMinor: 10000,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-01-31',
    });
    await runDueRecurringRules('2026-02-27');
    const tree = await open(() => require('../../app/(tabs)/plan'));
    try {
      const { RunwayCard } = require('@/features/plan/RunwayCard');
      const { runway } = tree.root.findByType(RunwayCard).props;
      expect(runway.short).toBeNull();
      expect(runway.endMinor).toBe(5000);
      expect(
        runway.days.filter((d: { outMinor: number }) => d.outMinor > 0).map((d: { date: string }) => d.date)
      ).toEqual(['2026-02-28']);
    } finally {
      act(() => tree.unmount());
    }
  });
});

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
  it('keeps archived foreign-account currency in history without restoring its active account card', async () => {
    const foreign = await createAccount({
      name: 'Archived USD history',
      type: 'bank',
      currency: 'USD',
      openingBalanceMinor: 0,
    });
    const date = new Date();
    await createTransaction({
      type: 'expense',
      accountId: foreign.id,
      categoryId: seededCategoryId,
      amountMinor: 123400,
      date: toLocalIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
      note: 'Foreign history regression',
    });
    await archiveAccount(foreign.id);
    const tree = await open(SCREENS[0][1]);
    const { formatMoney } = require('@/lib/money');
    expect(textOf(tree)).toContain(formatMoney(123400, 'USD'));
    const { HomeAccounts } = require('@/features/home/HomeAccounts');
    expect(
      tree.root.findByType(HomeAccounts).props.accounts.some((a: { id: string }) => a.id === foreign.id)
    ).toBe(false);
    act(() => tree.unmount());
  });
  // The month card steps by swiping; a screen reader gets the same as two actions on its figure.
  const step = async (tree: ReactTestRenderer, dir: 'decrement' | 'increment') => {
    await act(async () => {
      tree.root
        .find(
          (n) =>
            Array.isArray(n.props.accessibilityActions) &&
            n.props.accessibilityActions.some((a: { name: string }) => a.name === 'decrement') &&
            typeof n.props.onAccessibilityAction === 'function'
        )
        .props.onAccessibilityAction({ nativeEvent: { actionName: dir } });
    });
  };
  const { periodLabel } = require('@/lib/period');
  const monthName = (offset: number) => periodLabel({ granularity: 'month', offset });

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
    expect(textOf(tree)).toContain(monthName(0));
    expect(textOf(tree)).toContain('Bills left');

    await step(tree, 'decrement');
    await settle();

    const back = textOf(tree);
    expect(back).toContain(monthName(-1));
    expect(back).not.toContain('Bills left');
    expect(back).not.toContain('Short after bills');
    // The short caption names deductions; the expanded sum below retains income and carryover.
    expect(back).toContain('after spending and savings');
    // And the sum behind "How this adds up" itemises both.
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'How this adds up' && n.props.onPress)
        .props.onPress();
    });
    const sum = textOf(tree);
    expect(sum).toContain('Carried over');
    expect(sum).toContain(`+${formatMoney(carry)}`);
    expect(sum).toContain(formatMoney(lastMonth.incomeMinor));

    await step(tree, 'increment');
    await settle();
    const again = textOf(tree);
    expect(again).toContain(monthName(0));
    expect(again).toContain('Bills left');
    act(() => tree.unmount());
  });

  it('keeps the accounts on screen while stepping, instead of blanking them', async () => {
    const tree = await open(SCREENS[0][1]);
    expect(textOf(tree)).toContain('Bank');
    for (let i = 0; i < 4; i++) {
      await step(tree, 'decrement');
      expect(textOf(tree)).toContain('Accounts');
      expect(textOf(tree)).toContain('Bank');
    }
    await settle();
    expect(textOf(tree)).toContain('Bank');
    for (let i = 0; i < 4; i++) await step(tree, 'increment');
    await settle();
    expect(textOf(tree)).toContain(monthName(0));
    expect(textOf(tree)).toContain('Bank');
    act(() => tree.unmount());
  });

  it('lands on the last month asked for when stepped quickly', async () => {
    const tree = await open(SCREENS[0][1]);
    await act(async () => {
      for (let i = 0; i < 3; i++) {
        tree.root
          .find(
            (n) =>
              typeof n.props.onAccessibilityAction === 'function' &&
              Array.isArray(n.props.accessibilityActions)
          )
          .props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
      }
    });
    await settle();
    // Three taps before a re-render each ask for the month before the one on screen.
    expect(textOf(tree)).toContain(monthName(-1));
    act(() => tree.unmount());
  });
  it('keeps Accounts before Next up and opens recent entries over Home', async () => {
    const tree = await open(SCREENS[0][1]);
    const { Section } = require('@/components/Section');
    const titles = tree.root.findAllByType(Section).map((n) => n.props.title);
    expect(titles.indexOf('Accounts')).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf('Next up')).toBeGreaterThan(titles.indexOf('Accounts'));
    expect(titles).not.toContain('Spending');
    expect(tree.root.findAllByProps({ testID: 'home-swipe-pages' })).toHaveLength(0);
    const { RecentTransactionRow } = require('@/features/home/RecentTransactionRow');
    const row = tree.root.findAllByType(RecentTransactionRow)[0];
    expect(row).toBeDefined();
    await act(async () => row.props.onPress());
    const { TransactionDetailModal } = require('@/features/transactions/TransactionDetailModal');
    expect(tree.root.findByType(TransactionDetailModal).props.tx.id).toBe(row.props.tx.id);
    act(() => tree.root.findByType(TransactionDetailModal).props.onClose());
    expect(tree.root.findAllByType(TransactionDetailModal)).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('keeps Home spending drill-downs in the displayed period', async () => {
    const { router } = require('expo-router');
    const navigate = jest.spyOn(router, 'navigate');
    const push = jest.spyOn(router, 'push');
    const tree = await open(SCREENS[0][1]);
    await step(tree, 'decrement');
    await settle();
    act(() =>
      tree.root
        .findAll((n) => n.props.accessibilityLabel === 'See spending insights' && n.props.onPress)[0]
        .props.onPress()
    );
    expect(navigate).toHaveBeenLastCalledWith({ pathname: '/reports', params: { month: '-1' } });
    const { HeroActions } = require('@/features/home/HeroActions');
    const action = tree.root
      .findByType(HeroActions)
      .findAll((n) => n.props.accessibilityLabel === 'Add expense' && n.props.onPress)[0];
    expect(action).toBeDefined();
    act(() => action.props.onPress());
    expect(push).toHaveBeenLastCalledWith('/add-transaction?type=expense');
    act(() => tree.unmount());
  });
});

describe('Plan links open the selected existing flow', () => {
  beforeAll(async () => {
    await livedIn();
  });
  beforeEach(() => {
    mockHide = false;
    mockParams = {};
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('opens the selected savings goal and can close it without changing the ledger', async () => {
    const { listSavingsGoals } = require('@/db/savingsGoals');
    const goal = (await listSavingsGoals())[0];
    mockParams = { goal: goal.id };
    const tree = await open(() => require('../../app/savings-goals'));
    const { GoalDetailModal } = require('@/features/goals/GoalDetailModal');
    const detail = tree.root.findByType(GoalDetailModal);
    expect(detail.props.goal.id).toBe(goal.id);
    await act(async () => {
      detail.props.onClose();
    });
    expect(tree.root.findByType(GoalDetailModal).props.goal).toBeNull();
    expect((await listSavingsGoals()).find((g: { id: string }) => g.id === goal.id)).toEqual(goal);
    act(() => tree.unmount());
  });

  it('opens goal creation directly without creating a goal', async () => {
    mockParams = { add: '1' };
    const { listSavingsGoals } = require('@/db/savingsGoals');
    const before = await listSavingsGoals();
    const tree = await open(() => require('../../app/savings-goals'));
    const { AddGoalModal } = require('@/features/goals/AddGoalModal');
    expect(tree.root.findByType(AddGoalModal).props.visible).toBe(true);
    expect(await listSavingsGoals()).toEqual(before);
    act(() => tree.unmount());
  });

  it('opens the selected budget in the existing edit sheet', async () => {
    const { listBudgetsForMonth } = require('@/db/budgets');
    const budget = (await listBudgetsForMonth())[0];
    mockParams = { budget: budget.budget.id };
    const tree = await open(() => require('../../app/budgets'));
    const { AddBudgetModal } = require('@/features/budgets/AddBudgetModal');
    expect(tree.root.findByType(AddBudgetModal).props.visible).toBe(true);
    expect(tree.root.findByType(AddBudgetModal).props.editing.budget.id).toBe(budget.budget.id);
    act(() => tree.unmount());
  });

  it('opens budget creation directly', async () => {
    mockParams = { add: '1' };
    const tree = await open(() => require('../../app/budgets'));
    const { AddBudgetModal } = require('@/features/budgets/AddBudgetModal');
    expect(tree.root.findByType(AddBudgetModal).props.visible).toBe(true);
    expect(tree.root.findByType(AddBudgetModal).props.editing).toBeNull();
    act(() => tree.unmount());
  });

  it('opens a loan overview without starting its payment flow', async () => {
    const { listLoans } = require('@/db/loans');
    const loan = (await listLoans())[0];
    mockParams = { loan: loan.id };
    const tree = await open(() => require('../../app/loans'));
    const { LoanDetailModal } = require('@/features/loans/LoanDetailModal');
    expect(tree.root.findByType(LoanDetailModal).props.loan.id).toBe(loan.id);
    expect(tree.root.findByType(LoanDetailModal).props.startWithPay).toBe(false);
    act(() => tree.unmount());
  });
});

it('updates Home daily remaining after a transaction save, edit, refund and deletion', async () => {
  await freshDb();
  mockHide = false;
  mockParams = {};
  const { setDailySpendingGoal } = require('@/db/settings');
  const { updateTransaction, deleteTransaction } = require('@/db/ledger');
  const { emitTransactionsChanged } = require('@/lib/dataEvents');
  await setDailySpendingGoal(50000);
  const bank = await createAccount({
    name: 'Today bank',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 100000,
  });
  const food = await createCategory({ name: 'Today food', kind: 'expense' });
  const tree = await open(SCREENS[0][1]);
  try {
    expect(textOf(tree)).toContain('₹500 left today');
    let expense!: Awaited<ReturnType<typeof createTransaction>>;
    await act(async () => {
      expense = await createTransaction({
        type: 'expense',
        accountId: bank.id,
        categoryId: food.id,
        amountMinor: 7000,
        date: toLocalIsoDate(new Date()),
      });
      emitTransactionsChanged();
      await settle();
    });
    expect(textOf(tree)).toContain('₹430 left today');
    await act(async () => {
      await updateTransaction(expense.id, {
        type: 'expense',
        accountId: bank.id,
        categoryId: food.id,
        amountMinor: 10000,
        date: toLocalIsoDate(new Date()),
      });
      emitTransactionsChanged();
      await settle();
    });
    expect(textOf(tree)).toContain('₹400 left today');
    await act(async () => {
      await createTransaction({
        type: 'income',
        isRefund: true,
        accountId: bank.id,
        categoryId: food.id,
        amountMinor: 2000,
        date: toLocalIsoDate(new Date()),
      });
      emitTransactionsChanged();
      await settle();
    });
    expect(textOf(tree)).toContain('₹420 left today');
    await act(async () => {
      await deleteTransaction(expense.id);
      emitTransactionsChanged();
      await settle();
    });
    expect(textOf(tree)).toContain('₹500 left today');
  } finally {
    act(() => tree.unmount());
  }
});

it('refreshes daily remaining together with the current month after period navigation', async () => {
  await freshDb();
  mockHide = false;
  mockParams = {};
  const { setDailySpendingGoal } = require('@/db/settings');
  const { ThisMonthHero } = require('@/features/home/ThisMonthHero');
  await setDailySpendingGoal(50000);
  const bank = await createAccount({
    name: 'Period bank',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 100000,
  });
  const food = await createCategory({ name: 'Period food', kind: 'expense' });
  const tree = await open(SCREENS[0][1]);
  try {
    expect(textOf(tree)).toContain('₹500 left today');
    await createTransaction({
      type: 'expense',
      accountId: bank.id,
      categoryId: food.id,
      amountMinor: 7000,
      date: toLocalIsoDate(new Date()),
    });
    await act(async () => {
      tree.root.findByType(ThisMonthHero).props.onStep(-1);
      await settle();
    });
    await act(async () => {
      tree.root.findByType(ThisMonthHero).props.onStep(1);
      await settle();
    });
    expect(tree.root.findByType(ThisMonthHero).props.spentMinor).toBe(7000);
    expect(textOf(tree)).toContain('₹430 left today');
  } finally {
    act(() => tree.unmount());
  }
});

it('refreshes today spending when Home returns from the background without navigation', async () => {
  await freshDb();
  mockHide = false;
  mockParams = {};
  const { AppState } = require('react-native');
  const { setDailySpendingGoal } = require('@/db/settings');
  const callbacks: ((state: string) => void)[] = [];
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    callbacks.push(callback as (state: string) => void);
    return { remove: jest.fn() };
  });
  await setDailySpendingGoal(50000);
  const bank = await createAccount({
    name: 'Foreground bank',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 100000,
  });
  const food = await createCategory({ name: 'Foreground food', kind: 'expense' });
  const tree = await open(SCREENS[0][1]);
  try {
    expect(textOf(tree)).toContain('₹500 left today');
    await createTransaction({
      type: 'expense',
      accountId: bank.id,
      categoryId: food.id,
      amountMinor: 7000,
      date: toLocalIsoDate(new Date()),
    });
    await act(async () => {
      callbacks.forEach((callback) => callback('active'));
      await settle();
    });
    expect(textOf(tree)).toContain('₹430 left today');
    expect(textOf(tree)).toContain('₹70 spent today');
  } finally {
    act(() => tree.unmount());
    subscription.mockRestore();
  }
});
