/**
 * Profile's "You" section: the tracked balance spelled out as a sum that
 * adds up, counts that open their screens, accounts as one card with a
 * total, archived accounts folded away, and one row pointing to Plan —
 * without repeating the blocks that now live on Plan.
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

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

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
  mockLoans.mockResolvedValue([homeLoan(null)]);
});

// Loads React Native's lazily-required components once, up front, with a
// generous budget — on a cold run their first load can outlast one test's.
beforeAll(async () => {
  mockLoans.mockResolvedValue([]);
  await render();
}, 180000);

describe('Profile · You section', () => {
  it('spells the tracked balance out as a sum whose lines add up to it', async () => {
    const shown = texts(await render());
    // ₹99,999 − ₹5,00,000 + ₹2,500 = −₹3,97,501, built from the lines as shown.
    expect(shown).toEqual(
      expect.arrayContaining([
        'Tracked balance',
        '−₹3,97,501',
        'Your accounts',
        '+₹99,999',
        'Loans',
        '−₹5,00,000',
        'Friends & Family',
        '+₹2,500',
      ])
    );
  });

  it('shows every account in one card with a footer total that matches the rows', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'Accounts',
        'Salary account',
        '₹84,200',
        'Rainy day',
        '₹15,799',
        'Account balance · 2 accounts',
        '₹99,999',
      ])
    );
  });

  it('counts entries, loans and people, and each count opens its screen', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['284', 'Entries', '1', 'Active loans', 'People']));
    press(tree, '284 Entries');
    expect(router.navigate).toHaveBeenCalledWith('/transactions');
    press(tree, '1 Active loans');
    expect(router.push).toHaveBeenCalledWith('/loans');
    press(tree, '1 People');
    expect(router.push).toHaveBeenCalledWith('/people');
  });

  it("says why the balance runs negative when a loan's asset isn't tracked, and links to Loans", async () => {
    const tree = await render();
    const hint = texts(tree).find((t) => t.startsWith("A loan's home or vehicle isn't counted"));
    expect(hint).toBeDefined();
    press(tree, hint!);
    expect(router.push).toHaveBeenCalledWith('/loans');
  });

  it('explains equity instead once every loan has its asset value', async () => {
    mockLoans.mockResolvedValue([homeLoan(80000000)]);
    const shown = texts(await render());
    expect(shown).toContain(
      'Loans with a tracked asset value count their real equity here, not just the debt.'
    );
    expect(shown.some((t) => t.startsWith("A loan's home or vehicle"))).toBe(false);
    expect(shown).toEqual(expect.arrayContaining(['+₹3,00,000', '₹4,02,499'])); // ₹8,00,000 home − ₹5,00,000 owed
  });

  it('leaves the loans line out when there are no loans', async () => {
    mockLoans.mockResolvedValue([]);
    const shown = texts(await render());
    expect(shown).not.toContain('Loans');
    expect(shown).toContain('₹1,02,499'); // ₹99,999 + ₹2,500
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
