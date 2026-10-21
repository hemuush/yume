/**
 * The loan detail sheet: which EMI it offers next (and whether that one is overdue or early), what it says when
 * Pay can't work, and that a slow earlier load never overwrites a newer one. Names and figures are made up.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000); // cold module loading is slow while the whole suite runs in parallel

const mockGetLoanById = jest.fn(async (..._a: unknown[]) => null as unknown);
const mockGetSchedule = jest.fn(async (..._a: unknown[]) => [] as unknown[]);
const mockListAccounts = jest.fn(async (..._a: unknown[]) => [] as unknown[]);
const mockListCategories = jest.fn(async (..._a: unknown[]) => [] as unknown[]);

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/db/loans', () => ({
  getLoanById: (...a: unknown[]) => mockGetLoanById(...a),
  getLoanSchedule: (...a: unknown[]) => mockGetSchedule(...a),
  getLoanRateHistory: async () => [],
  deleteLoan: jest.fn(),
  restoreLoan: jest.fn(),
}));
jest.mock('@/db/ledger', () => ({
  listAccounts: (...a: unknown[]) => mockListAccounts(...a),
  listCategories: (...a: unknown[]) => mockListCategories(...a),
}));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), warn: jest.fn(), confirm: jest.fn() } }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
  SheetFooter: ({ children, onMore }: { children: unknown; onMore?: () => void }) =>
    require('react').createElement(require('react-native').View, { testID: 'loan-footer', onMore }, children),
}));
jest.mock('@/components/SheetCard', () => ({
  SheetCard: (p: { title: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'card', title: p.title }),
}));
jest.mock('@/components/SettingsRow', () => ({
  SettingsRow: (p: { label: string; sub?: string }) =>
    require('react').createElement(require('react-native').View, {
      testID: `row-${p.label}`,
      sub: p.sub,
    }),
}));
jest.mock('@/components/SegmentedControl', () => ({ SegmentedControl: () => null }));
jest.mock('@/components/ActionSheet', () => ({
  ActionList: (props: unknown) =>
    require('react').createElement(require('react-native').View, {
      testID: 'loan-actions',
      ...(props as object),
    }),
}));
jest.mock('./AssetModal', () => ({ AssetModal: () => null }));
jest.mock('./AccountModal', () => ({ AccountModal: () => null }));
jest.mock('./RateChangeModal', () => ({ RateChangeModal: () => null }));
jest.mock('./PrepayModal', () => ({ PrepayModal: () => null }));
jest.mock('./PayInstallmentSheet', () => ({ PayInstallmentSheet: () => null }));
jest.mock('./LoanSchedule', () => ({ LoanSchedule: () => null }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { ModalSheet } from '@/components/ModalSheet';
import { PayInstallmentSheet } from './PayInstallmentSheet';
import { LoanDetailModal } from './LoanDetailModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { formatMoney } from '@/lib/money';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { weekdayDayMonth } from '@/lib/dateLabels';
import type { Loan, LoanPayment } from '@/types';

const todayIso = toLocalIsoDate(new Date());

const makeLoan = (id: string, counterparty: string, over: Partial<Loan> = {}): Loan =>
  ({
    id,
    counterparty,
    direction: 'borrowed',
    rateType: 'fixed',
    status: 'active',
    interestRateAnnualBp: 900,
    principalMinor: 1_200_000,
    outstandingPrincipalMinor: 900_000,
    emiAmountMinor: 100_000,
    startDate: '2026-01-01',
    linkedAccountId: null,
    assetValueMinor: null,
    assetLabel: null,
    ...over,
  }) as Loan;

const installment = (n: number, dueDate: string, status: LoanPayment['status'] = 'pending'): LoanPayment =>
  ({
    id: `i${n}`,
    loanId: 'l1',
    installmentNumber: n,
    dueDate,
    emiAmountMinor: 100_000,
    principalComponentMinor: 80_000,
    interestComponentMinor: 20_000,
    status,
  }) as LoanPayment;

const account = { id: 'a1', name: 'Test Bank', type: 'bank', currency: 'INR' };
const cat = (id: string, name: string, kind: string) => ({ id, name, kind, isSystem: true });
const emiCategories = [cat('c1', 'Loan EMI', 'expense'), cat('c2', 'Loan Repayment', 'income')];

const mounted: ReactTestRenderer[] = [];
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const payButton = (t: ReactTestRenderer) => t.root.findAllByType(PrimaryButton)[0];

async function render(loan: Loan = makeLoan('l1', 'Test Lender')) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<LoanDetailModal loan={loan} onClose={jest.fn()} onChanged={jest.fn()} />);
  });
  mounted.push(tree);
  return tree;
}

function setup(schedule: LoanPayment[], over: { accounts?: unknown[]; categories?: unknown[] } = {}) {
  mockGetLoanById.mockImplementation(async () => makeLoan('l1', 'Test Lender'));
  mockGetSchedule.mockImplementation(async () => schedule);
  mockListAccounts.mockImplementation(async () => over.accounts ?? [account]);
  mockListCategories.mockImplementation(async () => over.categories ?? emiCategories);
}

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
});

describe('next installment', () => {
  it('flags an installment already past due as overdue and offers it as an on-time payment', async () => {
    const due = addDaysToIsoDate(todayIso, -5);
    setup([
      installment(1, '2026-01-01', 'paid'),
      installment(2, due),
      installment(3, addDaysToIsoDate(due, 30)),
    ]);
    const tree = await render();
    const shown = texts(tree);
    expect(shown).toContain(`${weekdayDayMonth(due)} · overdue`);
    expect(shown).toContain('1 of 3');
    expect(payButton(tree).props.title).toBe(`Record EMI 2 · ${formatMoney(100_000)}`);
    expect(payButton(tree).props.disabled).toBe(false);
  });

  it('offers a future installment as paying early, not overdue', async () => {
    const due = addDaysToIsoDate(todayIso, 10);
    setup([installment(1, due)]);
    const tree = await render();
    expect(texts(tree)).toContain(weekdayDayMonth(due));
    expect(texts(tree).some((t) => t.includes('overdue'))).toBe(false);
    expect(payButton(tree).props.title).toBe(`Record EMI 1 · ${formatMoney(100_000)} · early`);
  });

  it('picks the lowest-numbered unpaid installment even when the schedule is out of order', async () => {
    setup([
      installment(3, addDaysToIsoDate(todayIso, 40)),
      installment(2, addDaysToIsoDate(todayIso, 10)),
      installment(1, '2026-01-01', 'paid'),
    ]);
    const tree = await render();
    expect(payButton(tree).props.title).toBe(`Record EMI 2 · ${formatMoney(100_000)} · early`);
  });

  it('says none are left and offers no pay button once every installment is paid', async () => {
    setup([installment(1, '2026-01-01', 'paid'), installment(2, '2026-02-01', 'paid')]);
    mockGetLoanById.mockResolvedValueOnce(
      makeLoan('l1', 'Test Lender', { status: 'closed', outstandingPrincipalMinor: 0 })
    );
    const tree = await render();
    expect(texts(tree)).toContain('None left');
    expect(texts(tree)).toContain('2 of 2');
    expect(tree.root.findAllByType(PrimaryButton)).toHaveLength(0);
  });
});

describe('when paying cannot work', () => {
  it('disables Pay and explains when the built-in EMI category is missing', async () => {
    setup([installment(1, addDaysToIsoDate(todayIso, 3))], {
      categories: [cat('x', 'Groceries', 'expense')],
    });
    const tree = await render();
    expect(payButton(tree).props.disabled).toBe(true);
    expect(texts(tree).some((t) => t.includes('The built-in "Loan EMI" category is missing'))).toBe(true);
  });

  it('uses the repayment category for a loan you lent, never an expense one', async () => {
    const lent = makeLoan('l1', 'Test Borrower', { direction: 'lent' });
    mockGetLoanById.mockImplementation(async () => lent);
    mockGetSchedule.mockImplementation(async () => [installment(1, addDaysToIsoDate(todayIso, 3))]);
    mockListAccounts.mockImplementation(async () => [account]);
    // Only the expense-kind "Loan EMI" exists: a lent loan must not fall back to it.
    mockListCategories.mockImplementation(async () => [cat('c1', 'Loan EMI', 'expense')]);
    const tree = await render(lent);
    expect(payButton(tree).props.disabled).toBe(true);
    expect(texts(tree).some((t) => t.includes('"Loan Repayment" category is missing'))).toBe(true);
  });

  it('disables Pay and asks for an account when there are none', async () => {
    setup([installment(1, addDaysToIsoDate(todayIso, 3))], { accounts: [] });
    const tree = await render();
    expect(payButton(tree).props.disabled).toBe(true);
    expect(texts(tree)).toContain('Add an account first to record payments against this loan.');
  });

  it('warns when the loan account was deleted and names the fallback account', async () => {
    mockGetLoanById.mockImplementation(async () =>
      makeLoan('l1', 'Test Lender', { linkedAccountId: 'gone' })
    );
    mockGetSchedule.mockImplementation(async () => [installment(1, addDaysToIsoDate(todayIso, 3))]);
    mockListAccounts.mockImplementation(async () => [account]);
    mockListCategories.mockImplementation(async () => emiCategories);
    const tree = await render();
    expect(
      texts(tree).some((t) => t.includes('original account is unavailable') && t.includes('Test Bank'))
    ).toBe(true);
  });

  it('shows the load error instead of silently leaving figures blank', async () => {
    mockGetLoanById.mockImplementation(async () => {
      throw new Error('disk unavailable');
    });
    mockGetSchedule.mockImplementation(async () => []);
    mockListAccounts.mockImplementation(async () => []);
    mockListCategories.mockImplementation(async () => []);
    const tree = await render();
    expect(texts(tree)).toContain("Couldn't load the latest details: disk unavailable");
  });
});

describe('stale loads', () => {
  it('ignores a slow earlier load that finishes after a newer one', async () => {
    let releaseOld!: () => void;
    const oldGate = new Promise<void>((r) => (releaseOld = r));
    mockGetLoanById.mockImplementation(async (id: unknown) => {
      if (id === 'l1') {
        await oldGate;
        return makeLoan('l1', 'Old Lender');
      }
      return makeLoan('l2', 'New Lender');
    });
    mockGetSchedule.mockImplementation(async () => []);
    mockListAccounts.mockImplementation(async () => [account]);
    mockListCategories.mockImplementation(async () => emiCategories);

    let tree!: ReactTestRenderer;
    const el = (loan: Loan) => <LoanDetailModal loan={loan} onClose={jest.fn()} onChanged={jest.fn()} />;
    await act(async () => {
      tree = create(el(makeLoan('l1', 'Old Lender')));
    });
    mounted.push(tree);
    // The caller switches to another loan while the first fetch is still in flight.
    await act(async () => tree.update(el(makeLoan('l2', 'New Lender'))));
    expect(tree.root.findByProps({ testID: 'card' }).props.title).toBe('New Lender');

    await act(async () => {
      releaseOld();
    });
    expect(tree.root.findByProps({ testID: 'card' }).props.title).toBe('New Lender');
  });
});

it('shows loan actions inside the existing sheet and returns to its overview', async () => {
  setup([installment(1, addDaysToIsoDate(todayIso, 10))]);
  const tree = await render();
  await act(async () => tree.root.findByProps({ testID: 'loan-footer' }).props.onMore());
  const actions = tree.root.findByProps({ testID: 'loan-actions' });
  expect(actions.props.items.map((item: { label: string }) => item.label)).toContain('Delete loan');
  expect(tree.root.findAllByProps({ testID: 'card' })).toHaveLength(0);
  expect(payButton(tree).props.title).toBe('Back to loan');
  await act(async () => payButton(tree).props.onPress());
  expect(tree.root.findAllByProps({ testID: 'loan-actions' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'card' }).length).toBeGreaterThan(0);
});

it('shows only the payment popup and restores the loan when it closes', async () => {
  setup([installment(1, todayIso)]);
  const tree = await render();
  expect(tree.root.findByType(ModalSheet).props.visible).toBe(true);
  act(() => payButton(tree).props.onPress());
  expect(tree.root.findByType(ModalSheet).props.visible).toBe(false);
  act(() => tree.root.findByType(PayInstallmentSheet).props.onClose());
  expect(tree.root.findByType(ModalSheet).props.visible).toBe(true);
});

it('does not flash a paid-off EMI or zero interest while the schedule is still loading', async () => {
  let release!: (value: unknown[]) => void;
  mockGetSchedule.mockImplementationOnce(
    () =>
      new Promise<unknown[]>((resolve) => {
        release = resolve;
      })
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <LoanDetailModal loan={makeLoan('loading', 'Loading loan')} onClose={jest.fn()} onChanged={jest.fn()} />
    );
  });
  const labels = tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join(' ');
  expect(labels).toContain('Loading…');
  expect(labels).not.toContain('None left');
  expect(labels).not.toContain('Add an account first');
  await act(async () => {
    release([]);
  });
  act(() => tree.unmount());
});

it.each([false, true])(
  'keeps the recorded EMI in its confirmation while refreshing (last=%s)',
  async (last) => {
    setup([installment(1, todayIso), ...(last ? [] : [installment(2, addDaysToIsoDate(todayIso, 30))])]);
    const tree = await render();
    act(() => payButton(tree).props.onPress());
    mockGetSchedule.mockResolvedValueOnce(
      last
        ? [installment(1, todayIso, 'paid')]
        : [installment(1, todayIso, 'paid'), installment(2, addDaysToIsoDate(todayIso, 30))]
    );
    await act(async () => tree.root.findByType(PayInstallmentSheet).props.onPaid());
    expect(tree.root.findByType(PayInstallmentSheet).props.installment.id).toBe('i1');
    expect(tree.root.findByType(ModalSheet).props.visible).toBe(false);
    act(() => tree.root.findByType(PayInstallmentSheet).props.onClose());
    expect(tree.root.findByType(ModalSheet).props.visible).toBe(true);
  }
);

it('provides a retry after a detail-load failure', async () => {
  setup([installment(1, todayIso)]);
  mockGetLoanById.mockRejectedValueOnce(new Error('disk unavailable'));
  const tree = await render();
  const retry = tree.root.findAllByType(PrimaryButton).find((b) => b.props.title === 'Retry');
  expect(retry).toBeDefined();
  await act(async () => retry!.props.onPress());
  expect(texts(tree)).not.toContain("Couldn't load the latest details: disk unavailable");
});

it('identifies an outstanding loan with no schedule as incomplete', async () => {
  setup([]);
  const tree = await render();
  expect(texts(tree)).toContain('Schedule unavailable');
  expect(texts(tree)).not.toContain('None left');
});

it('allows recording an overdue EMI on a defaulted loan', async () => {
  setup([installment(1, todayIso)]);
  const loan = makeLoan('l1', 'Test Lender', { status: 'defaulted' });
  mockGetLoanById.mockResolvedValueOnce(loan);
  const tree = await render(loan);
  expect(payButton(tree).props.disabled).toBe(false);
});

it('clears the old child payment when another loan opens while its details are loading', async () => {
  setup([installment(1, todayIso)]);
  const tree = await render();
  act(() => payButton(tree).props.onPress());
  let release!: (loan: Loan) => void;
  mockGetLoanById.mockImplementationOnce(() => new Promise<Loan>((r) => (release = r)));
  const nextLoan = makeLoan('l2', 'Another lender');
  await act(async () =>
    tree.update(<LoanDetailModal loan={nextLoan} onClose={jest.fn()} onChanged={jest.fn()} />)
  );
  expect(tree.root.findAllByType(PayInstallmentSheet)).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'card' }).props.title).toBe('Another lender');
  await act(async () => release(nextLoan));
});
