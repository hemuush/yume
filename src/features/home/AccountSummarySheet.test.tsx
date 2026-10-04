/** The read-only account peek on Home: tabs, in/out figures, a card's bill, latest entries, and load failures. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

const mockFlow = jest.fn(async (..._a: unknown[]) => undefined as unknown);
const mockList = jest.fn(async (..._a: unknown[]) => [] as unknown);
const mockCycle = jest.fn(async (..._a: unknown[]) => null as unknown);
const mockValuations = jest.fn(async (..._a: unknown[]) => [] as unknown);
const mockRules = jest.fn(async (..._a: unknown[]) => [] as unknown);
jest.mock('@/db/ledger', () => ({
  getAccountFlow: (...a: unknown[]) => mockFlow(...a),
  listTransactions: (...a: unknown[]) => mockList(...a),
}));
jest.mock('@/db/cardCycles', () => ({ getCardCycle: (...a: unknown[]) => mockCycle(...a) }));
jest.mock('@/db/valuations', () => ({ listValuations: (...a: unknown[]) => mockValuations(...a) }));
jest.mock('@/db/recurring', () => ({ listRecurringRules: (...a: unknown[]) => mockRules(...a) }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8CCED6' }) }));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
function mockStub(testID: string) {
  return (p: object) => require('react').createElement(require('react-native').View, { testID, ...p });
}
jest.mock('@/components/SheetCard', () => ({ SheetCard: mockStub('card') }));
jest.mock('@/components/SegmentedControl', () => ({ SegmentedControl: mockStub('tabs') }));
jest.mock('./RecentTransactionRow', () => ({ RecentTransactionRow: mockStub('row') }));
jest.mock('@/features/investments/InvestmentPanel', () => ({ InvestmentPanel: mockStub('panel') }));
jest.mock('@/features/investments/UpdateValueSheet', () => ({ UpdateValueSheet: mockStub('value-sheet') }));

import { AccountSummarySheet } from './AccountSummarySheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { formatMoney } from '@/lib/money';
import { CURRENT_PERIOD } from '@/lib/period';
import type { Account, Category, Transaction } from '@/types';

const account = (over: Partial<Account> = {}) =>
  ({
    id: 'a1',
    name: 'Test Bank',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 0,
    currentBalanceMinor: 500_000,
    creditLimitMinor: null,
    statementDay: null,
    dueDay: null,
    interestRateAnnualBp: null,
    archived: false,
    createdAt: '2026-01-01',
    ...over,
  }) as Account;

const flow = {
  inMinor: 400_000,
  outMinor: 100_000,
  incomeMinor: 300_000,
  transferInMinor: 100_000,
  expenseMinor: 100_000,
  transferOutMinor: 0,
};
const tx = (id: string) =>
  ({ id, type: 'expense', accountId: 'a1', toAccountId: null, categoryId: 'c1' }) as unknown as Transaction;
const cycle = (over: object = {}) => ({
  accountId: 'a1',
  accountName: 'Test Card',
  cycleStart: '2026-06-02',
  cycleEnd: '2026-07-01',
  spentThisCycleMinor: 250_000,
  statementDate: '2026-06-01',
  statementMinor: 900_000,
  paidSinceMinor: 300_000,
  dueDate: '2026-06-20',
  leftToPayMinor: 600_000,
  daysUntilDue: 5,
  ...over,
});

const mounted: ReactTestRenderer[] = [];
const byId = (t: ReactTestRenderer, id: string) => t.root.findByProps({ testID: id });
const has = (t: ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }).length > 0;
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const button = (t: ReactTestRenderer, title: string) =>
  t.root.findAllByType(PrimaryButton).find((b) => b.props.title === title);

function element(props: Partial<React.ComponentProps<typeof AccountSummarySheet>> = {}) {
  return (
    <AccountSummarySheet
      account={account()}
      cursor={CURRENT_PERIOD}
      accounts={[account()]}
      categories={[{ id: 'c1', name: 'Test Food' } as Category]}
      onClose={jest.fn()}
      onAdd={jest.fn()}
      onEdit={jest.fn()}
      onSeeAll={jest.fn()}
      {...props}
    />
  );
}
async function render(props: Partial<React.ComponentProps<typeof AccountSummarySheet>> = {}) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element(props));
  });
  mounted.push(tree);
  return tree;
}
const pickTab = (t: ReactTestRenderer, value: string) =>
  act(async () => byId(t, 'tabs').props.onChange(value));

beforeEach(() => {
  mockHide = false;
  mockFlow.mockResolvedValue(flow);
  mockList.mockResolvedValue([]);
  mockCycle.mockResolvedValue(null);
  mockValuations.mockResolvedValue([]);
  mockRules.mockResolvedValue([]);
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  jest.clearAllMocks();
});

describe('AccountSummarySheet', () => {
  it('renders nothing without an account', async () => {
    const tree = await render({ account: null });
    expect(tree.toJSON()).toBeNull();
    expect(mockFlow).not.toHaveBeenCalled();
  });

  it('opens on the money in and out, with the net and what each side was made of', async () => {
    const tree = await render();
    expect(byId(tree, 'card').props.amount).toBe(formatMoney(500_000));
    expect(byId(tree, 'card').props.meta).toBe('Balance');
    const t = texts(tree);
    expect(t).toContain(`+${formatMoney(400_000)}`);
    expect(t).toContain(`−${formatMoney(100_000)}`);
    expect(t).toContain(`Income ${formatMoney(300_000)} · from your accounts ${formatMoney(100_000)}`);
    expect(t).toContain(`Spent ${formatMoney(100_000)}`);
    expect(t).toContain(`${formatMoney(300_000)} more came in than went out.`);
  });

  it('asks for the flow of this account over the period it is looking at', async () => {
    await render();
    expect(mockFlow).toHaveBeenCalledWith('a1', { start: expect.any(String), end: expect.any(String) });
    expect(mockList).toHaveBeenCalledWith({ accountId: 'a1', limit: 3 });
  });

  it('says so when nothing moved', async () => {
    mockFlow.mockResolvedValue({
      ...flow,
      inMinor: 0,
      outMinor: 0,
      incomeMinor: 0,
      transferInMinor: 0,
      expenseMinor: 0,
    });
    const tree = await render();
    expect(texts(tree)).toContain('Nothing moved in or out this month.');
  });

  it('says so when in and out cancel exactly', async () => {
    mockFlow.mockResolvedValue({ ...flow, inMinor: 100_000, outMinor: 100_000 });
    const tree = await render();
    expect(texts(tree)).toContain('Everything that came in went out.');
  });

  it('says it was a year when browsing a year', async () => {
    mockFlow.mockResolvedValue({ ...flow, inMinor: 0, outMinor: 0 });
    const tree = await render({ cursor: { granularity: 'year', offset: 0 } });
    expect(texts(tree)).toContain('Nothing moved in or out this year.');
  });

  it('shows a failure instead of an empty month when the figures cannot be read', async () => {
    mockFlow.mockRejectedValue(new Error('disk'));
    const tree = await render();
    expect(texts(tree)).toContain("Couldn't load this account's figures.");
    await pickTab(tree, 'latest');
    expect(texts(tree)).toContain("Couldn't load this account's entries.");
  });

  it('lists the latest entries and opens Activity for the account', async () => {
    mockList.mockResolvedValue([tx('t1'), tx('t2')]);
    const onSeeAll = jest.fn();
    const tree = await render({ onSeeAll });
    await pickTab(tree, 'latest');
    expect(new Set(tree.root.findAllByProps({ testID: 'row' }).map((n) => n.props.tx.id))).toEqual(
      new Set(['t1', 't2'])
    );
    const see = tree.root.findAll(
      (n) => n.props.accessibilityLabel === 'See everything in Test Bank in Activity' && !!n.props.onPress
    )[0];
    act(() => see.props.onPress());
    expect(onSeeAll).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('says so when nothing is recorded, and offers no See all', async () => {
    const tree = await render();
    await pickTab(tree, 'latest');
    expect(texts(tree)).toContain('Nothing recorded against this account yet.');
    expect(texts(tree)).not.toContain('See all in Activity');
  });

  it('hands the account to Edit and to Add expense here', async () => {
    const onEdit = jest.fn();
    const onAdd = jest.fn();
    const tree = await render({ onEdit, onAdd });
    act(() => button(tree, 'Edit account')!.props.onPress());
    act(() => button(tree, 'Add expense here')!.props.onPress());
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('turns the add button into a transfer for a savings account', async () => {
    const savings = account({ type: 'savings' });
    const tree = await render({ account: savings, accounts: [savings] });
    expect(button(tree, 'Transfer from here')).toBeDefined();
    expect(button(tree, 'Add expense here')).toBeUndefined();
  });

  it('masks a savings balance and its flow when amounts are hidden, but not a bank balance', async () => {
    mockHide = true;
    const savings = account({ type: 'savings' });
    const hidden = await render({ account: savings, accounts: [savings] });
    expect(byId(hidden, 'card').props.amount).not.toBe(formatMoney(500_000));
    expect(texts(hidden).some((s) => s.includes('••••'))).toBe(true);

    const bank = await render();
    expect(byId(bank, 'card').props.amount).toBe(formatMoney(500_000));
  });

  it('follows the accounts list so a new balance shows without reopening', async () => {
    const tree = await render();
    await act(async () => {
      tree.update(element({ accounts: [account({ currentBalanceMinor: 900_000 })] }));
    });
    expect(byId(tree, 'card').props.amount).toBe(formatMoney(900_000));
  });
});

describe('AccountSummarySheet — credit card bill', () => {
  const card = account({ type: 'credit_card', name: 'Test Card', statementDay: 1, dueDay: 20 });

  it('shows the cycle, the last statement, what was paid and what is left', async () => {
    mockCycle.mockResolvedValue(cycle());
    const tree = await render({ account: card, accounts: [card] });
    const t = texts(tree);
    expect(t).toContain('Bill');
    expect(t).toContain(formatMoney(250_000));
    expect(t).toContain(formatMoney(900_000));
    expect(t).toContain(formatMoney(300_000));
    expect(t.some((s) => s.startsWith('Left to pay by '))).toBe(true);
  });

  it('offers Pay bill for what is left, and hands that amount on', async () => {
    mockCycle.mockResolvedValue(cycle());
    const onPayBill = jest.fn();
    const tree = await render({ account: card, accounts: [card], onPayBill });
    const pay = button(tree, `Pay bill · ${formatMoney(600_000)}`)!;
    act(() => pay.props.onPress());
    expect(onPayBill).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 600_000);
  });

  it('says Paid in full and offers no Pay bill once nothing is left', async () => {
    mockCycle.mockResolvedValue(cycle({ leftToPayMinor: 0 }));
    const tree = await render({ account: card, accounts: [card], onPayBill: jest.fn() });
    expect(texts(tree)).toContain('Paid in full');
    expect(
      tree.root.findAllByType(PrimaryButton).some((b) => String(b.props.title).startsWith('Pay bill'))
    ).toBe(false);
  });

  it('says a bill is late once it is past due', async () => {
    mockCycle.mockResolvedValue(cycle({ daysUntilDue: -3 }));
    const tree = await render({ account: card, accounts: [card] });
    expect(texts(tree).some((s) => s.startsWith('Left to pay · was due '))).toBe(true);
  });

  it('shows a failure when the bill cannot be read, without hiding the flow', async () => {
    mockCycle.mockRejectedValue(new Error('disk'));
    const tree = await render({ account: card, accounts: [card] });
    expect(texts(tree)).toContain("Couldn't load this card's bill.");
    expect(texts(tree)).toContain('Money in and out');
  });
});

describe('AccountSummarySheet — tracked account', () => {
  const tracked = account({
    type: 'savings',
    investment: {
      investedMinor: 100_000,
      takenOutMinor: 0,
      gainMinor: 20_000,
      valuedAt: '2026-06-01',
      lastValueMinor: 120_000,
    },
    currentBalanceMinor: 120_000,
  });

  it('opens on the value tab with its valuations and next SIP', async () => {
    mockValuations.mockResolvedValue([{ id: 'v1' }]);
    mockRules.mockResolvedValue([
      {
        active: true,
        type: 'transfer',
        toAccountId: 'a1',
        accountId: 'src',
        amountMinor: 5_000,
        nextRunDate: '2099-02-01',
        endDate: null,
      },
      {
        active: true,
        type: 'transfer',
        toAccountId: 'a1',
        accountId: 'src',
        amountMinor: 7_000,
        nextRunDate: '2099-01-01',
        endDate: null,
      },
      {
        active: true,
        type: 'transfer',
        toAccountId: 'a1',
        accountId: 'src',
        amountMinor: 9_000,
        nextRunDate: '2020-01-01',
        endDate: '2020-06-01',
      },
      {
        active: false,
        type: 'transfer',
        toAccountId: 'a1',
        accountId: 'src',
        amountMinor: 1_000,
        nextRunDate: '2098-01-01',
        endDate: null,
      },
    ]);
    const tree = await render({ account: tracked, accounts: [tracked] });
    expect(byId(tree, 'card').props.kicker).toBe('savings · tracked');
    expect(has(tree, 'panel')).toBe(true);
    expect(byId(tree, 'panel').props.valuations).toEqual([{ id: 'v1' }]);
    expect(byId(tree, 'panel').props.nextSip).toEqual({
      amountMinor: 7_000,
      date: '2099-01-01',
      fromName: undefined,
    });
  });

  it('falls back to no valuations when they cannot be read', async () => {
    mockValuations.mockRejectedValue(new Error('disk'));
    const tree = await render({ account: tracked, accounts: [tracked] });
    expect(byId(tree, 'panel').props.valuations).toEqual([]);
  });

  it('opens the value sheet from the panel and reports a save', async () => {
    const onChanged = jest.fn();
    const tree = await render({ account: tracked, accounts: [tracked], onChanged });
    act(() => byId(tree, 'panel').props.onUpdate());
    expect(has(tree, 'value-sheet')).toBe(true);
    act(() => byId(tree, 'value-sheet').props.onSaved());
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(has(tree, 'value-sheet')).toBe(false);
  });

  it('closes the whole sheet after a value is deleted', async () => {
    const onChanged = jest.fn();
    const onClose = jest.fn();
    const tree = await render({ account: tracked, accounts: [tracked], onChanged, onClose });
    act(() => byId(tree, 'panel').props.onEdit({ id: 'v1' }));
    act(() => byId(tree, 'value-sheet').props.onDeleted());
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
