/**
 * Profile's "You" section after the Plan tab took over budgets, goals,
 * recurring, What-if and the Garden: it shows the balance, stats and
 * accounts, points to Plan in one row, and no longer repeats those blocks.
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
    {
      id: 'a1',
      name: 'Salary account',
      type: 'bank',
      currency: 'INR',
      currentBalanceMinor: 8420000,
      archived: false,
    },
    ...(includeArchived
      ? [
          {
            id: 'a2',
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
jest.mock('@/db/loans', () => ({ listLoans: async () => [] }));
jest.mock('@/db/people', () => ({ listPeople: async () => [] }));
jest.mock('@/db/reports', () => ({ computeTrackedBalance: () => 8420000 }));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getDefaultCurrency: async () => 'INR',
}));
// The account dialogs aren't under test here.
jest.mock('./AddAccountModal', () => ({ AddAccountModal: () => null }));
jest.mock('./AccountDetailModal', () => ({ AccountDetailModal: () => null }));

import { YouSection } from './YouSection';
import { router } from 'expo-router';

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

// Loads React Native's lazily-required components once, up front, with a
// generous budget — on a cold run their first load can outlast one test's.
beforeAll(async () => {
  await render();
}, 180000);

describe('Profile · You section', () => {
  it('shows the balance, the stats and the accounts, including archived ones', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'TRACKED BALANCE',
        'ENTRIES',
        '284',
        'Accounts',
        'Salary account',
        'ARCHIVED ACCOUNTS',
        'Old wallet',
      ])
    );
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
    const pointer = tree.root.find(
      (n) => n.props.accessibilityLabel === 'Budgets, goals and recurring are in Plan' && n.props.onPress
    );
    act(() => pointer.props.onPress());
    expect(router.navigate).toHaveBeenCalledWith('/plan');
  });
});
