/**
 * Loans assembled on a real database: what it shows, which sheets open, and what does not make the page behind them
 * redraw. The cards and the hero are counted through wrappers that render the real ones; the sheets are stand-ins that
 * record what they were given.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(90000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn(), select: jest.fn() },
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null, HeaderIconButton: () => null }));
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
  loan: string | null;
  pay: boolean;
  close: (() => void) | null;
  adding: boolean;
  closeAdd: (() => void) | null;
} = { loan: null, pay: false, close: null, adding: false, closeAdd: null };
jest.mock('@/features/loans/LoanCard', () => {
  const actual = jest.requireActual('@/features/loans/LoanCard');
  return {
    LoanCard: (props: { loan: { id: string } }) => {
      mockDrawn.cards.push(props.loan.id);
      return actual.LoanCard(props);
    },
  };
});
jest.mock('@/features/loans/LoansHero', () => {
  const actual = jest.requireActual('@/features/loans/LoansHero');
  return {
    LoansHero: (props: unknown) => {
      mockDrawn.hero++;
      return actual.LoansHero(props);
    },
  };
});
jest.mock('@/features/loans/LoanDetailModal', () => ({
  LoanDetailModal: (props: { loan: { id: string }; startWithPay: boolean; onClose: () => void }) => {
    mockSheet.loan = props.loan.id;
    mockSheet.pay = props.startWithPay;
    mockSheet.close = props.onClose;
    return null;
  },
}));
jest.mock('@/features/loans/AddLoanModal', () => ({
  AddLoanModal: (props: { visible: boolean; onClose: () => void }) => {
    mockSheet.adding = props.visible;
    mockSheet.closeAdd = props.onClose;
    return null;
  },
}));

import { Text } from 'react-native';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { createLoan, getLoanSchedule, payInstallment } from '@/db/loans';
import { clearReadCache } from '@/db/readCache';
import { resetSettingsCache, setDefaultCurrency, setHasOnboarded, setUserName } from '@/db/settings';
import { toLocalIsoDate } from '@/lib/date';
import { LoanCard } from '@/features/loans/LoanCard';
import LoansScreen from '@/features/loans/LoansWorkspace';

const today = toLocalIsoDate(new Date());
let mounted: ReactTestRenderer | null = null;
let accountId = '';
let emiCategoryId = '';
let firstLoanId = '';

async function seed() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  clearReadCache();
  await setDefaultCurrency('INR');
  await setUserName('Tester');
  await setHasOnboarded(true);
  accountId = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 5_000_000 })
  ).id;
  emiCategoryId = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
  const start = `${today.slice(0, 4)}-01-01`;
  const first = await createLoan({
    direction: 'borrowed',
    counterparty: 'Home loan',
    principalMinor: 2_400_000,
    interestRateAnnualBp: 900,
    tenureMonths: 24,
    startDate: start,
    alreadyPaidInstallments: 2,
  });
  firstLoanId = first.id;
  await createLoan({
    direction: 'borrowed',
    counterparty: 'Bike loan',
    principalMinor: 600_000,
    interestRateAnnualBp: 1100,
    tenureMonths: 12,
    startDate: start,
    alreadyPaidInstallments: 1,
  });
}

const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function openLoans() {
  await act(async () => {
    mounted = create(<LoansScreen />);
  });
  await settle(50);
  await settle(50);
  return mounted!;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat(5).join(''));
const cards = (tree: ReactTestRenderer) => tree.root.findAllByType(LoanCard);
const showAgain = () =>
  act(async () => {
    mockFocus.forEach((cb) => {
      const undo = cb();
      if (typeof undo === 'function') mockUndo.push(undo);
    });
  });

beforeEach(async () => {
  mockFocus.clear();
  Object.assign(mockDrawn, { cards: [], hero: 0 });
  Object.assign(mockSheet, { loan: null, pay: false, close: null, adding: false, closeAdd: null });
  await seed();
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  // A focus effect that was run by hand leaves its timer (the one to the next midnight) until undone.
  mockUndo.splice(0).forEach((undo) => undo());
});

it('lists each loan once, under "Your loans"', async () => {
  const tree = await openLoans();
  expect(texts(tree)).toContain('Your loans');
  expect(new Set(mockDrawn.cards)).toEqual(new Set(await loanIds()));
  expect(cards(tree)).toHaveLength(2);
  expect(mockDrawn.hero).toBeGreaterThan(0);
});

async function loanIds() {
  return (await mockDb.getAllAsync<{ id: string }>('SELECT id FROM loans')).map((r) => r.id);
}

it('opens a loan’s detail from its card, and the Pay pill opens it on the pay sheet', async () => {
  const tree = await openLoans();
  act(() => cards(tree)[0].props.onPress());
  expect(mockSheet.loan).toBe(cards(tree)[0].props.loan.id);
  expect(mockSheet.pay).toBe(false);
  act(() => mockSheet.close!());
  mockSheet.loan = null;
  act(() => cards(tree)[1].props.onPay());
  expect(mockSheet.loan).toBe(cards(tree)[1].props.loan.id);
  expect(mockSheet.pay).toBe(true);
});

it('opens the new-loan form from the header', async () => {
  const tree = await openLoans();
  const add = tree.root.find((n) => typeof n.props.onPress === 'function' && n.props.label === '+ Loan');
  act(() => add.props.onPress());
  expect(mockSheet.adding).toBe(true);
  act(() => mockSheet.closeAdd!());
  expect(mockSheet.adding).toBe(false);
});

it('does not redraw the cards or the hero when a sheet opens or closes', async () => {
  const tree = await openLoans();
  await settle(200);
  const drawn = { cards: mockDrawn.cards.length, hero: mockDrawn.hero };
  act(() => cards(tree)[0].props.onPress());
  act(() => mockSheet.close!());
  const add = tree.root.find((n) => typeof n.props.onPress === 'function' && n.props.label === '+ Loan');
  act(() => add.props.onPress());
  act(() => mockSheet.closeAdd!());
  expect(mockDrawn.cards.length).toBe(drawn.cards);
  expect(mockDrawn.hero).toBe(drawn.hero);
});

it('draws nothing again for a reload that found the same loans', async () => {
  await openLoans();
  await settle(200);
  const drawn = { cards: mockDrawn.cards.length, hero: mockDrawn.hero };
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.cards.length).toBe(drawn.cards);
  expect(mockDrawn.hero).toBe(drawn.hero);
});

it('draws only the loan that changed when one EMI is paid', async () => {
  await openLoans();
  await settle(200);
  const drawn = mockDrawn.cards.length;
  const next = (await getLoanSchedule(firstLoanId)).find((p) => p.status !== 'paid')!;
  await payInstallment(next.id, { accountId, categoryId: emiCategoryId, paidDate: today });
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.cards.slice(drawn)).toEqual([firstLoanId]);
});
