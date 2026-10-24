/**
 * The Investments page: totals and holdings from the accounts, the gain and yearly rate, SIPs, the actions
 * (Invest opens Add into the holding; Add a SIP opens the recurring sheet prefilled) and hidden amounts.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(60000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), navigate: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8', onAccent: '#12130F' }),
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
// Heavy sheets are covered on their own; here only whether they are asked for.
jest.mock('@/features/home/AccountSummarySheet', () => ({
  AccountSummarySheet: (p: { account: unknown }) =>
    require('react').createElement(
      require('react-native').Text,
      { testID: 'summary' },
      p.account ? 'summary-open' : ''
    ),
}));
jest.mock('@/features/profile/AccountDetailModal', () => ({ AccountDetailModal: () => null }));
jest.mock('@/features/profile/AddAccountModal', () => ({
  AddAccountModal: (p: { visible: boolean; initialChoice?: string }) =>
    require('react').createElement(
      require('react-native').Text,
      { testID: 'add-account' },
      p.visible ? `add-${p.initialChoice}` : ''
    ),
}));
const mockRule = jest.fn();
jest.mock('@/features/recurring/RuleModal', () => ({
  RuleModal: (p: { visible: boolean; editing: unknown; prefill: unknown }) => {
    if (p.visible) mockRule(p.editing, p.prefill);
    return null;
  },
}));
jest.mock('@/features/investments/UpdateValuesSheet', () => ({
  UpdateValuesSheet: (p: { visible: boolean }) =>
    require('react').createElement(
      require('react-native').Text,
      { testID: 'updating' },
      p.visible ? 'updating' : ''
    ),
}));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: () => null,
  SheetLink: () => null,
  SheetFooter: () => null,
}));
jest.mock('@/features/investments/HoldingPickerSheet', () => ({ HoldingPickerSheet: () => null }));
jest.mock('@/db/settings', () => ({ getDefaultCurrency: async () => 'INR' }));
const mockAccounts = jest.fn();
jest.mock('@/db/ledger', () => ({
  listAccounts: () => mockAccounts(),
  listCategories: async () => [],
}));
const mockRules = jest.fn();
jest.mock('@/db/recurring', () => ({ listRecurringRules: () => mockRules() }));
const mockHistory = jest.fn();
jest.mock('@/db/investmentHistory', () => ({ listInvestmentHistory: () => mockHistory() }));

import InvestmentsScreen from '../../../app/investments';
import type { Account, RecurringRule } from '@/types';
import { formatMoney } from '@/lib/money';

// Amounts are written in the device's own grouping, so expectations are built the same way.
const inr = (minor: number) => formatMoney(minor, 'INR');

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(today.getTime() - n * 86_400_000));

const bank = { id: 'bank', name: 'HDFC', type: 'bank', currency: 'INR', archived: false } as Account;
const fund = {
  id: 'fund',
  name: 'Nifty 50',
  type: 'savings',
  currency: 'INR',
  archived: false,
  openingBalanceMinor: 400_000_00,
  currentBalanceMinor: 438_000_00,
  createdAt: `${daysAgo(500)} 10:00:00`,
  investment: {
    investedMinor: 400_000_00,
    takenOutMinor: 0,
    gainMinor: 38_000_00,
    valuedAt: daysAgo(12),
    lastValueMinor: 438_000_00,
    kind: 'mutual_fund',
    fundingAccountId: 'bank',
  },
} as Account;
const gold = {
  ...fund,
  id: 'gold',
  name: 'Digital gold',
  currentBalanceMinor: 100_000_00,
  openingBalanceMinor: 100_000_00,
  createdAt: `${daysAgo(500)} 10:00:00`,
  investment: {
    ...fund.investment,
    investedMinor: 100_000_00,
    gainMinor: null,
    valuedAt: null,
    lastValueMinor: null,
    kind: 'gold',
    fundingAccountId: null,
  },
} as Account;
const sip = {
  id: 'r1',
  type: 'transfer',
  accountId: 'bank',
  toAccountId: 'fund',
  categoryId: null,
  amountMinor: 10_000_00,
  note: 'SIP',
  paymentMode: null,
  frequency: 'monthly',
  intervalCount: 1,
  nextRunDate: '2030-11-05',
  endDate: null,
  active: true,
} as RecurringRule;

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<InvestmentsScreen />);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const press = async (tree: ReactTestRenderer, title: string) =>
  act(async () => {
    tree.root.find((n) => n.props.title === title && typeof n.props.onPress === 'function').props.onPress();
  });

beforeEach(() => {
  mockHide = false;
  mockPush.mockClear();
  mockRule.mockClear();
  mockAccounts.mockResolvedValue([bank, fund, gold]);
  mockRules.mockResolvedValue([sip]);
  mockHistory.mockResolvedValue({
    flows: [],
    valuations: [{ accountId: 'fund', date: daysAgo(12), valueMinor: 438_000_00 }],
  });
});

describe('Investments page', () => {
  it('shows what the holdings add up to, with the gain from the ones that have a value', async () => {
    const shown = texts(await render());
    expect(shown).toContain('Worth now');
    expect(shown.some((t) => t.includes(inr(538_000_00)))).toBe(true); // 4,38,000 + 1,00,000
    expect(shown.some((t) => t.includes(inr(500_000_00)))).toBe(true); // invested
    expect(shown).toContain('Nifty 50');
    expect(shown).toContain('Digital gold');
    expect(shown.some((t) => /1 holding has no value yet/.test(t))).toBe(true);
  });

  it('lists the SIPs with where each comes from and the month’s total', async () => {
    const shown = texts(await render());
    expect(shown.some((t) => / · from HDFC · next /.test(t))).toBe(true);
    expect(shown.some((t) => t.includes(`${inr(10_000_00)} a month goes in by SIP`))).toBe(true);
  });

  it('masks every figure while savings are hidden', async () => {
    mockHide = true;
    const shown = texts(await render()).join(' ');
    expect(shown).not.toContain(inr(538_000_00));
    expect(shown).not.toContain(inr(438_000_00));
    expect(shown).toContain('••••');
  });

  it('opens Add as a transfer into the holding from its funding account, once a holding is picked', async () => {
    const tree = await render();
    await press(tree, 'Invest');
    // Two holdings: it asks which one first.
    expect(mockPush).not.toHaveBeenCalled();
    const picker = tree.root.find((n) => n.props.title === 'Invest in which one?');
    await act(async () => picker.props.onPick(picker.props.holdings[0]));
    expect(mockPush).toHaveBeenCalledWith('/add-transaction?type=transfer&accountId=bank&toAccountId=fund');
  });

  it('goes straight to Add when there is a single holding', async () => {
    mockAccounts.mockResolvedValue([bank, fund]);
    const tree = await render();
    await press(tree, 'Invest');
    expect(mockPush).toHaveBeenCalledWith('/add-transaction?type=transfer&accountId=bank&toAccountId=fund');
  });

  it('opens the recurring sheet prefilled as a monthly transfer into the holding for a new SIP', async () => {
    mockAccounts.mockResolvedValue([bank, fund]);
    const tree = await render();
    await press(tree, 'Add a SIP');
    const [editing, prefill] = mockRule.mock.calls[mockRule.mock.calls.length - 1];
    expect(editing).toBeNull();
    expect(prefill).toMatchObject({
      type: 'transfer',
      accountId: 'bank',
      toAccountId: 'fund',
      note: 'SIP',
      categoryId: null,
    });
  });

  it('edits an existing SIP in the same sheet', async () => {
    const tree = await render();
    const row = tree.root.find(
      (n) => n.props.label === 'Nifty 50' && n.props.value && typeof n.props.onPress === 'function'
    );
    await act(async () => row.props.onPress());
    expect(mockRule.mock.calls[mockRule.mock.calls.length - 1][0]).toMatchObject({ id: 'r1' });
  });

  it('opens a holding’s sheet, Update values and the add-investment form', async () => {
    const tree = await render();
    const row = tree.root.find((n) => n.props.label === 'Digital gold' && n.props.icon === 'trending-up');
    await act(async () => row.props.onPress());
    expect(texts(tree)).toContain('summary-open');
    await press(tree, 'Update values');
    expect(texts(tree)).toContain('updating');
    await press(tree, 'Add an investment');
    expect(texts(tree)).toContain('add-investment');
  });

  it('invites a first investment when there are none', async () => {
    mockAccounts.mockResolvedValue([bank]);
    mockRules.mockResolvedValue([]);
    mockHistory.mockResolvedValue({ flows: [], valuations: [] });
    const tree = await render();
    expect(texts(tree)).toContain('Watch what you have grown');
    await press(tree, 'Add an investment');
    expect(texts(tree)).toContain('add-investment');
  });
});
