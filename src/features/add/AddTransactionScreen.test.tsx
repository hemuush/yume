/**
 * The Add screen's save paths, with the data layer mocked:
 *   - a new expense saves with the remembered account/category, remembers
 *     them again, and goes back
 *   - a missing amount or category shows an error and saves nothing
 *   - staged entries save together; if one fails, only the unsaved ones stay
 *   - a friend entry without an account only adjusts the person's balance
 *   - editing updates the transaction instead of creating one
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import { Alert, Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react-native').View,
  KeyboardStickyView: require('react-native').View,
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/components/OdometerAmount', () => ({ OdometerAmount: () => null }));
jest.mock('@/features/profile/AddAccountModal', () => ({ AddAccountModal: () => null }));
jest.mock('@/features/transactions/CalendarSheet', () => ({ CalendarSheet: () => null }));

const mockParams: { current: { type?: string; id?: string } } = { current: {} };
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams.current,
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

const account = (id: string, name: string, type = 'bank') => ({
  id,
  name,
  type,
  currency: 'INR',
  openingBalanceMinor: 0,
  archived: false,
});
const category = (id: string, name: string, kind: 'expense' | 'income') => ({
  id,
  name,
  kind,
  icon: 'tag',
  color: '#8FCBFF',
  parentId: null,
  archived: false,
});
jest.mock('@/db/ledger', () => ({
  listAccounts: jest.fn(async () => [account('bank', 'Bank'), account('cash', 'Cash', 'cash')]),
  listCategories: jest.fn(async () => [
    category('food', 'Food', 'expense'),
    category('salary', 'Salary', 'income'),
  ]),
  createTransaction: jest.fn(async () => ({})),
  updateTransaction: jest.fn(async () => ({})),
  deleteTransaction: jest.fn(),
  getTransactionById: jest.fn(async () => null),
  getTransactionLink: jest.fn(async () => null),
  getFrequentAmountsForCategory: jest.fn(async () => []),
  getRecentCategoryIds: jest.fn(async () => []),
}));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getAddDefaults: jest.fn(async () => ({})),
  setAddDefaults: jest.fn(async () => {}),
}));
jest.mock('@/db/people', () => ({
  listPeople: jest.fn(async () => [{ id: 'p1', name: 'Aarav', balanceMinor: 0, lastActivityDate: null }]),
  recordMoneyGivenToPerson: jest.fn(async () => {}),
  recordMoneyReceivedFromPerson: jest.fn(async () => {}),
  addLedgerEntry: jest.fn(async () => {}),
}));

import AddTransactionScreen from '../../../app/add-transaction';
import { router } from 'expo-router';
import { createTransaction, updateTransaction, getTransactionById } from '@/db/ledger';
import { getAddDefaults, setAddDefaults } from '@/db/settings';
import { addLedgerEntry } from '@/db/people';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AddTransactionScreen />);
  });
  await act(settle);
  return tree;
}

const textOf = (n: ReactTestInstance) => [].concat(n.props.children).join('');
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map(textOf);

/** The innermost pressable whose visible text is exactly `label`. */
function pressable(tree: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => textOf(t) === label)
  );
  if (matches.length === 0) throw new Error(`No pressable labelled "${label}"`);
  return matches.reduce((a, b) => (b.findAllByType(Text).length < a.findAllByType(Text).length ? b : a));
}
async function press(tree: ReactTestRenderer, label: string) {
  await act(async () => {
    await pressable(tree, label).props.onPress();
    await settle();
  });
}
async function typeAmount(tree: ReactTestRenderer, value: string) {
  await act(async () => {
    tree.root
      .find((n) => n.props.accessibilityLabel === 'Amount' && n.props.onChangeText)
      .props.onChangeText(value);
  });
}
/** Save, then wait past the short "done" tick before going back. */
async function save(tree: ReactTestRenderer, title = 'Save') {
  await act(async () => {
    await tree.root
      .find((n) => n.props.title === title && typeof n.props.onPress === 'function')
      .props.onPress();
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
}

// Loads React Native's lazily-required components once, with a generous budget.
beforeAll(async () => {
  await render();
}, 180000);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
});

describe('Add screen', () => {
  it('saves a new expense with the remembered account and category, remembers them, and goes back', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'cash', categoryId: 'food' },
    });
    const tree = await render();
    await typeAmount(tree, '250');
    await save(tree);

    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', accountId: 'cash', categoryId: 'food', amountMinor: 25000 })
    );
    expect(setAddDefaults).toHaveBeenCalledWith(
      expect.objectContaining({ expense: { accountId: 'cash', categoryId: 'food' } })
    );
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('asks for an amount, then a category, and saves nothing until both are there', async () => {
    const tree = await render();
    await save(tree);
    expect(texts(tree)).toContain('Enter an amount');

    await typeAmount(tree, '120');
    await save(tree);
    expect(texts(tree)).toContain('Pick a category');
    expect(createTransaction).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('saves staged entries together, and after a failure keeps only the ones not saved', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'bank', categoryId: 'food' },
    });
    (createTransaction as jest.Mock).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('disk full'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await render();

    await typeAmount(tree, '100');
    await press(tree, 'Add to list');
    await typeAmount(tree, '200');
    await press(tree, 'Add to list');
    await save(tree, 'Save 2 entries');

    expect(createTransaction).toHaveBeenCalledTimes(2);
    expect(alert).toHaveBeenCalledWith('Only some entries saved', expect.stringContaining('1 of 2 saved'));
    expect(router.back).not.toHaveBeenCalled();
    // Only the unsaved second entry is left to retry.
    expect(texts(tree)).toContain('Save 1 entry');
    alert.mockRestore();
  });

  it('a friend entry with no account only adjusts their balance', async () => {
    const tree = await render();
    await press(tree, 'Friend');
    await press(tree, 'Aarav');
    await typeAmount(tree, '300');
    await save(tree);

    expect(addLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'p1', amountMinor: 30000 })
    );
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('editing updates the transaction instead of creating a new one', async () => {
    mockParams.current = { id: 't1' };
    (getTransactionById as jest.Mock).mockResolvedValueOnce({
      id: 't1',
      type: 'expense',
      amountMinor: 45000,
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'food',
      note: 'Dinner',
      date: '2026-09-20',
    });
    const tree = await render();
    await typeAmount(tree, '500');
    await save(tree, 'Save changes');

    expect(updateTransaction).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ amountMinor: 50000, categoryId: 'food', note: 'Dinner', date: '2026-09-20' })
    );
    expect(createTransaction).not.toHaveBeenCalled();
  });
});
