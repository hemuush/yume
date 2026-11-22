/**
 * What the You page draws again for each thing done on it: a sheet opening or closing, the archived row opening and a
 * reload that found the same accounts draw what changed, not every account tile.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
const mockFocus = new Set<() => void | (() => void)>();
const mockUndo: (() => void)[] = [];
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => {
    mockFocus.add(cb);
    require('react').useEffect(cb, [cb]);
  },
}));
// Every account tile asks for its icon once each time it is drawn.
const mockDrawn = { tiles: [] as string[] };
jest.mock('@/lib/account', () => {
  const actual = jest.requireActual('@/lib/account');
  return {
    ...actual,
    accountIcon: (type: string, investment: unknown) => {
      mockDrawn.tiles.push(type);
      return actual.accountIcon(type, investment);
    },
  };
});
const accounts = [
  { id: 'a1', name: 'Salary account', type: 'bank', currency: 'INR', currentBalanceMinor: 8420040 },
  { id: 'a2', name: 'Cash', type: 'cash', currency: 'INR', currentBalanceMinor: 120000 },
  { id: 'a3', name: 'Wallet', type: 'wallet', currency: 'INR', currentBalanceMinor: 50000 },
].map((a) => ({ ...a, archived: false }));
const archived = {
  id: 'a4',
  name: 'Old card',
  type: 'credit_card',
  currency: 'INR',
  currentBalanceMinor: 0,
  archived: true,
};
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const mockAccounts = jest.fn();
jest.mock('@/db/ledger', () => ({
  listAccounts: (includeArchived?: boolean) => mockAccounts(includeArchived),
  countTransactions: async () => 12,
}));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));
jest.mock('@/db/loans', () => ({ listLoans: async () => [] }));
jest.mock('@/db/people', () => ({ listPeople: async () => [] }));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getDefaultCurrency: async () => 'INR',
}));
const mockSheet: {
  account: string | null;
  closeAccount: (() => void) | null;
  adding: boolean;
  closeAdd: (() => void) | null;
} = { account: null, closeAccount: null, adding: false, closeAdd: null };
jest.mock('./AddAccountModal', () => ({
  AddAccountModal: (p: { visible: boolean; onClose: () => void }) => {
    mockSheet.adding = p.visible;
    mockSheet.closeAdd = p.onClose;
    return null;
  },
}));
jest.mock('./AccountDetailModal', () => ({
  AccountDetailModal: (p: { account: { id: string } | null; onClose: () => void }) => {
    mockSheet.account = p.account?.id ?? null;
    mockSheet.closeAccount = p.onClose;
    return null;
  },
}));

import { YouSection } from './YouSection';

let mounted: ReactTestRenderer | null = null;
const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function render() {
  await act(async () => {
    mounted = create(<YouSection />);
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
  mockDrawn.tiles = [];
  Object.assign(mockSheet, { account: null, closeAccount: null, adding: false, closeAdd: null });
  mockAccounts.mockImplementation(async (includeArchived?: boolean) =>
    copy(includeArchived ? [...accounts, archived] : accounts)
  );
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  mockUndo.splice(0).forEach((undo) => undo());
});

it('opens an account from its tile and the new-account form from the header', async () => {
  const tree = await render();
  expect(new Set(mockDrawn.tiles)).toEqual(new Set(['bank', 'cash', 'wallet']));
  press(tree, (p) => typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.startsWith('Cash,'));
  expect(mockSheet.account).toBe('a2');
  act(() => mockSheet.closeAccount!());
  expect(mockSheet.account).toBeNull();
  press(tree, (p) => p.accessibilityLabel === 'Add an account');
  expect(mockSheet.adding).toBe(true);
  act(() => mockSheet.closeAdd!());
});

it('does not redraw an account tile when a sheet opens or closes', async () => {
  const tree = await render();
  await settle(100);
  const drawn = mockDrawn.tiles.length;
  expect(drawn).toBeGreaterThan(0);
  press(tree, (p) => typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.startsWith('Cash,'));
  act(() => mockSheet.closeAccount!());
  press(tree, (p) => p.accessibilityLabel === 'Add an account');
  act(() => mockSheet.closeAdd!());
  expect(mockDrawn.tiles.length).toBe(drawn);
});

it('draws only the archived tile when the archived row opens', async () => {
  const tree = await render();
  await settle(100);
  const drawn = mockDrawn.tiles.length;
  press(
    tree,
    (p) => typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.startsWith('Archived accounts')
  );
  expect(mockDrawn.tiles.slice(drawn)).toEqual(['credit_card']);
});

it('draws nothing again for a reload that found the same accounts', async () => {
  const tree = await render();
  await settle(100);
  const drawn = mockDrawn.tiles.length;
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.tiles.length).toBe(drawn);
  expect(tree.root.findAllByType(Text).length).toBeGreaterThan(0);
});

it('draws only the account whose balance changed', async () => {
  await render();
  await settle(100);
  const drawn = mockDrawn.tiles.length;
  mockAccounts.mockImplementation(async (includeArchived?: boolean) =>
    copy(
      (includeArchived ? [...accounts, archived] : accounts).map((a) =>
        a.id === 'a3' ? { ...a, currentBalanceMinor: 90000 } : a
      )
    )
  );
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.tiles.slice(drawn)).toEqual(['wallet']);
});
