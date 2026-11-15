/**
 * What the Investments page draws again for each thing done on it: a sheet opening or closing, the trend's stretch
 * changing and a reload that found the same data draw the part concerned, not the totals, the chart and the rows.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(60000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockFocus = new Set<() => void | (() => void)>();
const mockUndo: (() => void)[] = [];
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => {
    mockFocus.add(cb);
    require('react').useEffect(cb, [cb]);
  },
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8', onAccent: '#12130F' }),
}));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));

const mockDrawn = { hero: 0, chart: 0, rows: [] as string[] };
// The totals card draws its worth figure once each time it is drawn.
jest.mock('@/components/CountUpAmount', () => ({
  CountUpAmount: () => {
    mockDrawn.hero++;
    return null;
  },
}));
jest.mock('@/features/investments/PortfolioChart', () => ({
  PortfolioChart: () => {
    mockDrawn.chart++;
    return null;
  },
}));
// Every holding's row asks for its estimate once each time it is drawn.
jest.mock('@/lib/investment', () => {
  const actual = jest.requireActual('@/lib/investment');
  return {
    ...actual,
    estimatedValue: (account: { name: string }, today: string) => {
      mockDrawn.rows.push(account.name);
      return actual.estimatedValue(account, today);
    },
  };
});
const mockSheets: {
  summary: string | null;
  closeSummary: (() => void) | null;
  updating: boolean;
  closeUpdate: (() => void) | null;
  adding: boolean;
  closeAdd: (() => void) | null;
} = { summary: null, closeSummary: null, updating: false, closeUpdate: null, adding: false, closeAdd: null };
jest.mock('@/features/home/AccountSummarySheet', () => ({
  AccountSummarySheet: (p: { account: { id: string } | null; onClose: () => void }) => {
    mockSheets.summary = p.account?.id ?? null;
    mockSheets.closeSummary = p.onClose;
    return null;
  },
}));
jest.mock('@/features/profile/AccountDetailModal', () => ({ AccountDetailModal: () => null }));
jest.mock('@/features/profile/AddAccountModal', () => ({
  AddAccountModal: (p: { visible: boolean; onClose: () => void }) => {
    mockSheets.adding = p.visible;
    mockSheets.closeAdd = p.onClose;
    return null;
  },
}));
jest.mock('@/features/recurring/RuleModal', () => ({ RuleModal: () => null }));
jest.mock('@/features/investments/UpdateValuesSheet', () => ({
  UpdateValuesSheet: (p: { visible: boolean; onClose: () => void }) => {
    mockSheets.updating = p.visible;
    mockSheets.closeUpdate = p.onClose;
    return null;
  },
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
import { SegmentedControl } from '@/components/SegmentedControl';
import type { Account } from '@/types';

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);
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
  investment: { ...fund.investment, investedMinor: 100_000_00, kind: 'gold' },
} as Account;
const history = {
  flows: [],
  valuations: [
    { accountId: 'fund', date: daysAgo(300), valueMinor: 400_000_00 },
    { accountId: 'fund', date: daysAgo(12), valueMinor: 438_000_00 },
  ],
};

// A read always hands back fresh copies, as the database does.
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
let mounted: ReactTestRenderer | null = null;
const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function render() {
  await act(async () => {
    mounted = create(<InvestmentsScreen />);
  });
  await settle(20);
  return mounted!;
}
const showAgain = () =>
  act(async () => {
    mockFocus.forEach((cb) => {
      const undo = cb();
      if (typeof undo === 'function') mockUndo.push(undo);
    });
  });
const press = (tree: ReactTestRenderer, match: (props: Record<string, unknown>) => boolean) =>
  act(() => {
    tree.root.find((n) => typeof n.props.onPress === 'function' && match(n.props)).props.onPress();
  });

beforeEach(() => {
  mockFocus.clear();
  Object.assign(mockDrawn, { hero: 0, chart: 0, rows: [] });
  Object.assign(mockSheets, {
    summary: null,
    closeSummary: null,
    updating: false,
    closeUpdate: null,
    adding: false,
    closeAdd: null,
  });
  mockAccounts.mockImplementation(async () => copy([bank, fund, gold]));
  mockRules.mockImplementation(async () => []);
  mockHistory.mockImplementation(async () => copy(history));
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  mockUndo.splice(0).forEach((undo) => undo());
});

it('draws every holding once, and opens the sheets from the buttons and the rows', async () => {
  const tree = await render();
  expect(new Set(mockDrawn.rows)).toEqual(new Set(['Nifty 50', 'Digital gold']));
  await press(tree, (p) => p.title === 'Update values');
  expect(mockSheets.updating).toBe(true);
  act(() => mockSheets.closeUpdate!());
  expect(mockSheets.updating).toBe(false);
  await press(tree, (p) => p.accessibilityLabel === 'Add an investment');
  expect(mockSheets.adding).toBe(true);
  act(() => mockSheets.closeAdd!());
  await press(tree, (p) => typeof p.label === 'string' && p.label === 'Nifty 50');
  expect(mockSheets.summary).toBe('fund');
  act(() => mockSheets.closeSummary!());
  expect(mockSheets.summary).toBeNull();
});

it('does not redraw the totals, the chart or the rows when a sheet opens or closes', async () => {
  const tree = await render();
  await settle(100);
  const drawn = { hero: mockDrawn.hero, chart: mockDrawn.chart, rows: mockDrawn.rows.length };
  expect(drawn.hero).toBeGreaterThan(0);
  expect(drawn.chart).toBeGreaterThan(0);
  await press(tree, (p) => p.title === 'Update values');
  act(() => mockSheets.closeUpdate!());
  await press(tree, (p) => p.accessibilityLabel === 'Add an investment');
  act(() => mockSheets.closeAdd!());
  await press(tree, (p) => typeof p.label === 'string' && p.label === 'Nifty 50');
  act(() => mockSheets.closeSummary!());
  expect({ hero: mockDrawn.hero, chart: mockDrawn.chart, rows: mockDrawn.rows.length }).toEqual(drawn);
});

it('draws only the trend when its stretch changes', async () => {
  const tree = await render();
  await settle(100);
  const drawn = { hero: mockDrawn.hero, rows: mockDrawn.rows.length, chart: mockDrawn.chart };
  act(() => tree.root.findByType(SegmentedControl).props.onChange('all'));
  expect(mockDrawn.chart).toBeGreaterThan(drawn.chart);
  expect(mockDrawn.hero).toBe(drawn.hero);
  expect(mockDrawn.rows.length).toBe(drawn.rows);
});

it('draws nothing again for a reload that found the same data', async () => {
  await render();
  await settle(100);
  const drawn = { hero: mockDrawn.hero, chart: mockDrawn.chart, rows: mockDrawn.rows.length };
  await showAgain();
  await settle(100);
  await settle(100);
  expect({ hero: mockDrawn.hero, chart: mockDrawn.chart, rows: mockDrawn.rows.length }).toEqual(drawn);
});
