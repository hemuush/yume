/**
 * Profile's "You" section: accounts first, tracked balance opening to a sum that adds up, tiles, accounts by
 * type with subtotals, archived folded away, a Plan row. Totals including savings are masked while hidden.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/db/ledger', () => ({
  listAccounts: jest.fn(async (includeArchived?: boolean) => [
    // ₹84,200.40 and ₹15,799.40 show as ₹84,200 and ₹15,799 — ₹99,999 together.
    {
      id: 'a1',
      name: 'Salary account',
      type: 'bank',
      currency: 'INR',
      currentBalanceMinor: 8420040,
      archived: false,
    },
    {
      id: 'a2',
      name: 'Rainy day',
      type: 'savings',
      currency: 'INR',
      currentBalanceMinor: 1579940,
      archived: false,
    },
    ...(includeArchived
      ? [
          {
            id: 'a3',
            name: 'Old wallet',
            type: 'wallet',
            currency: 'INR',
            currentBalanceMinor: 0,
            archived: true,
          },
        ]
      : []),
  ]),
  countTransactions: jest.fn(async () => 284),
}));
const mockLoans = jest.fn();
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/db/loans', () => ({ listLoans: () => mockLoans() }));
jest.mock('@/db/people', () => ({ listPeople: async () => [{ balanceMinor: 250000 }] }));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getDefaultCurrency: async () => 'INR',
}));
// The account dialogs aren't under test here.
jest.mock('./AddAccountModal', () => ({ AddAccountModal: () => null }));
jest.mock('./AccountDetailModal', () => ({ AccountDetailModal: () => null }));

import { YouSection } from './YouSection';
import { router } from 'expo-router';

const homeLoan = (assetValueMinor: number | null) => ({
  id: 'l1',
  counterparty: 'Home loan',
  direction: 'borrowed',
  status: 'active',
  outstandingPrincipalMinor: 50000000,
  assetValueMinor,
});

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<YouSection />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the load settle
  });
  return tree;
}

/** A node's text, nested Text (the big figure's ₹ in its own style) included. */
const flat = (c: unknown): string =>
  Array.isArray(c)
    ? c.map(flat).join('')
    : c && typeof c === 'object' && 'props' in c
      ? flat((c as { props: { children?: unknown } }).props.children)
      : c == null || typeof c === 'boolean'
        ? ''
        : String(c);
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map((t) => flat(t.props.children));

/** Presses the first pressable whose own text (or accessibility label) is `label`. */
function press(tree: ReactTestRenderer, label: string) {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      (n.props.accessibilityLabel === label ||
        n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label))
  );
  act(() => node.props.onPress());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHideAmounts = false;
  mockLoans.mockResolvedValue([homeLoan(null)]);
});

// Loads React Native's lazily-required components once, up front, with a
// generous budget — on a cold run their first load can outlast one test's.
beforeAll(async () => {
  mockLoans.mockResolvedValue([]);
  await render();
}, 180000);

/** Opens the tracked-balance line to show the sum behind it. */
const openTracked = (tree: ReactTestRenderer) => press(tree, 'Tracked balance');

describe('Profile · You section', () => {
  it('leads with what is in your accounts, and keeps the tracked balance to one line', async () => {
    const shown = texts(await render());
    // ₹99,999 − ₹5,00,000 + ₹2,500 = −₹3,97,501, built from the lines as shown.
    expect(shown).toEqual(
      expect.arrayContaining([
        'In your accounts',
        '₹99,999',
        'across 2 accounts',
        'Tracked balance',
        '−₹3,97,501',
      ])
    );
    expect(shown).not.toContain('Loans');
  });

  it('spells the tracked balance out as a sum whose lines add up once opened', async () => {
    const tree = await render();
    openTracked(tree);
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Your accounts',
        '+₹99,999',
        'Loans',
        '−₹5,00,000',
        'Friends & Family',
        '+₹2,500',
      ])
    );
  });

  it('groups accounts by type, each group with a subtotal that matches its rows', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'Accounts',
        'Bank · 1',
        'Salary account',
        '₹84,200',
        'Savings · 1',
        'Rainy day',
        '₹15,799',
      ])
    );
    // The accounts total is shown once, in the hero, not again as a footer.
    expect(shown.some((t) => t.startsWith('Account balance'))).toBe(false);
  });

  it('counts entries, loans and friends, and each tile opens its screen', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['284', 'Entries', '1', 'Active loans', 'Friends']));
    press(tree, '284 Entries');
    expect(router.navigate).toHaveBeenCalledWith('/transactions');
    press(tree, '1 Active loans');
    expect(router.push).toHaveBeenCalledWith('/loans');
    press(tree, '1 Friends');
    expect(router.push).toHaveBeenCalledWith('/people');
  });

  it("says why the balance runs negative when a loan's asset isn't tracked, and links to Loans", async () => {
    const tree = await render();
    expect(texts(tree).some((t) => t.startsWith("A loan's home or vehicle"))).toBe(false);
    openTracked(tree);
    const hint = texts(tree).find((t) => t.startsWith("A loan's home or vehicle isn't counted"));
    expect(hint).toBeDefined();
    press(tree, hint!);
    expect(router.push).toHaveBeenCalledWith('/loans');
  });

  it('explains equity instead once every loan has its asset value', async () => {
    mockLoans.mockResolvedValue([homeLoan(80000000)]);
    const tree = await render();
    openTracked(tree);
    const shown = texts(tree);
    expect(shown).toContain(
      'Loans with a tracked asset value count their real equity here, not just the debt.'
    );
    expect(shown.some((t) => t.startsWith("A loan's home or vehicle"))).toBe(false);
    expect(shown).toEqual(expect.arrayContaining(['+₹3,00,000', '₹4,02,499'])); // ₹8,00,000 home − ₹5,00,000 owed
  });

  it('leaves the loans line out when there are no loans', async () => {
    mockLoans.mockResolvedValue([]);
    const tree = await render();
    openTracked(tree);
    const shown = texts(tree);
    expect(shown).not.toContain('Loans');
    expect(shown).toContain('₹1,02,499'); // ₹99,999 + ₹2,500
  });

  it('splits what is in your accounts by type under the big figure', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(expect.arrayContaining(['Bank ', '₹84,200', 'Savings ', '₹15,799']));
  });

  it('masks every total that includes savings while savings amounts are hidden', async () => {
    mockHideAmounts = true;
    const tree = await render();
    openTracked(tree);
    const shown = texts(tree);
    // Savings row, Savings subtotal, hero, tracked balance and the accounts line are all masked…
    expect(shown.filter((t) => t === '₹••••').length).toBeGreaterThanOrEqual(5);
    expect(shown).toContain('across 2 accounts · savings hidden');
    for (const leak of ['₹99,999', '+₹99,999', '₹15,799', '−₹3,97,501']) expect(shown).not.toContain(leak);
    // …while the bank account, the loan and the friend are not.
    expect(shown).toEqual(expect.arrayContaining(['₹84,200', '−₹5,00,000', '+₹2,500']));
  });

  it('folds archived accounts into one row that opens to show them', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Archived accounts', '1 account · tap to show']));
    expect(texts(tree)).not.toContain('Old wallet');
    press(tree, 'Archived accounts');
    expect(texts(tree)).toEqual(expect.arrayContaining(['Old wallet', 'Wallet · archived']));
  });

  it('no longer repeats what now lives on Plan', async () => {
    const shown = texts(await render());
    for (const gone of [
      'Budgets',
      'Savings goals',
      'Recurring',
      'What if?',
      "Suu's Garden — see what's grown",
    ]) {
      expect(shown).not.toContain(gone);
    }
  });

  it('points to Plan in one row, which opens the Plan tab', async () => {
    const tree = await render();
    expect(texts(tree)).toContain('Budgets, goals & recurring are in Plan');
    press(tree, 'Budgets, goals and recurring are in Plan');
    expect(router.navigate).toHaveBeenCalledWith('/plan');
  });
});
