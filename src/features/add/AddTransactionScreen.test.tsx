jest.mock('@/db/entryDraft', () => ({
  readEntryDraft: jest.fn(async () => null),
  writeEntryDraft: jest.fn(async () => {}),
}));
/**
 * The Add screen's save paths with the data layer mocked: save/edit, validation errors, staged batches,
 * friend entries, number-pad sums, repeat-check warning, account-follows-category, "Your usual" and search.
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import { Keyboard, Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react-native').View,
  KeyboardStickyView: require('react-native').View,
}));
// Keeps the header's right-hand button so a test can press it (the trash on an edit); what sits in the
// band (the type switch) still renders.
const mockHeaderRight: { current: React.ReactElement<{ onPress: () => void }> | null } = { current: null };
jest.mock('@/features/home/SkyHeader', () => ({
  SkyHeader: ({
    actions,
    children,
  }: {
    actions?: React.ReactElement<{ onPress: () => void }>;
    children?: React.ReactNode;
  }) => {
    mockHeaderRight.current = actions ?? null;
    return children ?? null;
  },
}));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
jest.mock('@/features/profile/AddAccountModal', () => ({ AddAccountModal: () => null }));
jest.mock('@/components/CalendarSheet', () => ({ CalendarSheet: () => null }));
jest.mock('@/features/home/RepeatEntrySheet', () => ({ RepeatEntrySheet: () => null }));
// Sheets render their contents in place while open.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
const mockAddPersonVisible = { current: false };
jest.mock('@/features/people/AddPersonModal', () => ({
  AddPersonModal: ({ visible }: { visible: boolean }) => {
    mockAddPersonVisible.current = visible;
    return null;
  },
}));

const mockDispatch = jest.fn();
// The leave guard: its latest "prevent?" flag and the callback that runs when a back is blocked.
const mockGuard: { prevent: boolean; onBlocked: (o: { data: { action: unknown } }) => void } = {
  prevent: false,
  onBlocked: () => {},
};
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (prevent: boolean, onBlocked: typeof mockGuard.onBlocked) => {
    mockGuard.prevent = prevent;
    mockGuard.onBlocked = onBlocked;
  },
}));

const mockParams: { current: Record<string, string | undefined> } = { current: {} };
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ dispatch: mockDispatch }),
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
    category('travel', 'Travel', 'expense'),
    { ...category('rapido', 'Rapido', 'expense'), parentId: 'travel' },
    category('salary', 'Salary', 'income'),
  ]),
  createTransaction: jest.fn(async () => ({})),
  updateTransaction: jest.fn(async () => ({})),
  deleteTransaction: jest.fn(),
  restoreTransaction: jest.fn(),
  getTransactionById: jest.fn(async () => null),
  getTransactionLink: jest.fn(async () => null),
  getFrequentAmountsForCategory: jest.fn(async () => []),
  getRepeatEntries: jest.fn(async () => []),
  getLastAccountForCategory: jest.fn(async () => null),
  findRecentRepeat: jest.fn(async () => null),
}));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getAddDefaults: jest.fn(async () => ({})),
  setAddDefaults: jest.fn(async () => {}),
}));
jest.mock('@/db/splits', () => ({
  saveSplit: jest.fn(async () => 'split-1'),
  getSplitParts: jest.fn(async () => []),
  deleteSplit: jest.fn(),
  restoreSplit: jest.fn(),
}));
jest.mock('@/db/people', () => ({
  listPeople: jest.fn(async () => [{ id: 'p1', name: 'Aarav', balanceMinor: 0, lastActivityDate: null }]),
  recordMoneyGivenToPerson: jest.fn(async () => {}),
  recordMoneyReceivedFromPerson: jest.fn(async () => {}),
  addLedgerEntry: jest.fn(async () => {}),
}));

import AddTransactionScreen from '../../../app/add-transaction';
import { router } from 'expo-router';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactionById,
  getLastAccountForCategory,
  findRecentRepeat,
  getRepeatEntries,
} from '@/db/ledger';
import { getAddDefaults, setAddDefaults } from '@/db/settings';
import { saveSplit, deleteSplit, restoreSplit, getSplitParts } from '@/db/splits';
import { TransferAccounts } from './AddSections';
import { openSplitSession, finishSplitSession, getSplitSession } from './splitSession';
import { addLedgerEntry, listPeople } from '@/db/people';
import { showAlert } from '@/components/AppDialog';

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
/** Presses an icon-only button by its accessibility label (the pad's Hide button has no text). */
async function pressLabelled(tree: ReactTestRenderer, label: string) {
  await act(async () => {
    await tree.root
      .find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')
      .props.onPress();
    await settle();
  });
}
const KEY_LABEL: Record<string, string> = {
  '.': 'decimal point',
  '+': 'plus',
  '−': 'minus',
  '×': 'times',
  '÷': 'divide',
};
/** Taps each character on the number pad. */
async function typeAmount(tree: ReactTestRenderer, value: string) {
  for (const ch of value) {
    const label = KEY_LABEL[ch] ?? ch;
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')
        .props.onPress();
    });
  }
}
/** Opens the pad from the amount (as an edit needs), and clears it with a long-press on ⌫. */
async function clearAmount(tree: ReactTestRenderer) {
  await act(async () => {
    tree.root
      .find(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith('Amount,') &&
          n.props.onPress
      )
      .props.onPress();
  });
  await act(async () => {
    tree.root
      .find((n) => n.props.accessibilityLabel === 'delete' && typeof n.props.onLongPress === 'function')
      .props.onLongPress();
  });
}
/** The Save button's title: plain "Save", or "Save ₹250 · Food" once there is something to name. */
const isSaveTitle = (t?: string) => t === 'Save' || !!t?.startsWith('Save ₹');
/** Save, then wait past the short "done" tick before going back. */
async function save(tree: ReactTestRenderer, title = 'Save') {
  await act(async () => {
    await tree.root
      .find(
        (n) =>
          (title === 'Save' ? isSaveTitle(n.props.title) : n.props.title === title) &&
          typeof n.props.onPress === 'function'
      )
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
  it('keeps Save disabled until the complete saved split has loaded and offers retry on failure', async () => {
    mockParams.current = { id: 't1', amount: '10000', categoryId: 'food' };
    const tx = {
      id: 't1',
      type: 'expense',
      amountMinor: 10000,
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'food',
      note: '',
      date: '2026-09-20',
      splitId: 's1',
    };
    jest
      .mocked(getTransactionById)
      .mockResolvedValueOnce(tx as never)
      .mockResolvedValueOnce(tx as never);
    jest
      .mocked(getSplitParts)
      .mockRejectedValueOnce(new Error('split read failed'))
      .mockResolvedValueOnce([
        { id: 't1', categoryId: 'food', amountMinor: 10000 },
        { id: 't2', categoryId: 'travel', amountMinor: 10000 },
      ] as never);
    const tree = await render();
    const button = tree.root.find((n) => isSaveTitle(n.props.title) && typeof n.props.onPress === 'function');
    expect(button.props.disabled).toBe(true);
    expect(mockHeaderRight.current).toBeNull();
    await act(async () => {
      button.props.onPress();
      await settle();
    });
    expect(createTransaction).not.toHaveBeenCalled();
    expect(updateTransaction).not.toHaveBeenCalled();
    await press(tree, 'Retry loading');
    expect(texts(tree)).toContain('Split 2 ways');
    expect(mockGuard.prevent).toBe(false);
    await save(tree, 'Save changes');
    expect(saveSplit).toHaveBeenCalledTimes(1);
    expect(updateTransaction).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('blocks Save while deletion is pending and never navigates after the edit closes', async () => {
    const changed = jest.spyOn(require('@/lib/dataEvents'), 'emitTransactionsChanged');
    mockParams.current = { id: 't1' };
    jest.mocked(getTransactionById).mockResolvedValueOnce({
      id: 't1',
      type: 'expense',
      amountMinor: 45000,
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'food',
      note: '',
      date: '2026-09-20',
    } as never);
    let finish!: (value: never) => void;
    jest.mocked(deleteTransaction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const tree = await render();
    const onSave = tree.root.find(
      (n) => n.props.title === 'Save changes' && typeof n.props.onPress === 'function'
    ).props.onPress;
    act(() => mockHeaderRight.current!.props.onPress());
    const remove = jest.mocked(showAlert).mock.calls[0][2]!.find((b) => b.text === 'Delete')!.onPress!;
    let deleting!: Promise<unknown>;
    await act(async () => {
      deleting = Promise.resolve(remove());
      await settle();
    });
    await act(async () => {
      onSave();
      await settle();
    });
    expect(updateTransaction).not.toHaveBeenCalled();
    act(() => tree.unmount());
    await act(async () => {
      finish({ table: 'transactions', row: { id: 't1' } } as never);
      await deleting;
    });
    expect(router.back).not.toHaveBeenCalled();
    expect(mockShowUndo).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
    changed.mockRestore();
  });

  it('allows retry after a deletion fails', async () => {
    mockParams.current = { id: 't1' };
    jest.mocked(getTransactionById).mockResolvedValueOnce({
      id: 't1',
      type: 'expense',
      amountMinor: 45000,
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'food',
      note: '',
      date: '2026-09-20',
    } as never);
    jest.mocked(deleteTransaction).mockRejectedValueOnce(new Error('database busy'));
    const tree = await render();
    act(() => mockHeaderRight.current!.props.onPress());
    await act(async () => {
      await jest.mocked(showAlert).mock.calls[0][2]!.find((b) => b.text === 'Delete')!.onPress!();
    });
    expect(texts(tree)).toContain('database busy');
    await save(tree, 'Save changes');
    expect(updateTransaction).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('ignores a queued save tap after the first save commits', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '120');
    const onSave = tree.root.find((n) => isSaveTitle(n.props.title) && typeof n.props.onPress === 'function')
      .props.onPress;
    await act(async () => {
      onSave();
      await settle();
    });
    expect(createTransaction).toHaveBeenCalledTimes(1);
    await act(async () => {
      onSave();
      await settle();
    });
    expect(createTransaction).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('hides shortcuts from the previous entry type while the next query loads', async () => {
    (getRepeatEntries as jest.Mock).mockResolvedValueOnce([
      {
        type: 'expense',
        accountId: 'bank',
        accountCurrency: 'INR',
        categoryId: 'food',
        categoryName: 'Old shortcut',
        categoryIcon: 'tag',
        categoryColor: '#8FCBFF',
        amountMinor: 12000,
        note: '',
        timesLogged: 3,
      },
    ]);
    let finish!: (entries: never[]) => void;
    (getRepeatEntries as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<never[]>((resolve) => {
          finish = resolve;
        })
    );
    const tree = await render();
    expect(texts(tree)).toContain('Old shortcut');
    await press(tree, 'Income');
    expect(texts(tree)).not.toContain('Old shortcut');
    await act(async () => {
      finish([]);
      await settle();
    });
  });

  it('explains whole-unit rounding and saves the displayed value', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '120.50');
    expect(texts(tree)).toContain('Saved in whole units: ₹121');
    await save(tree);
    expect(createTransaction).toHaveBeenLastCalledWith(expect.objectContaining({ amountMinor: 12100 }));
  });
  it('does not let an account lookup override a later manual choice', async () => {
    let finish!: (id: string) => void;
    (getLastAccountForCategory as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        })
    );
    const tree = await render();
    await press(tree, 'Food');
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel?.startsWith('Account,') && n.props.onPress)
        .props.onPress();
    });
    await act(async () => {
      tree.root.find((n) => n.props.accessibilityLabel === 'Cash' && n.props.onPress).props.onPress();
    });
    await act(async () => {
      finish('bank');
      await settle();
    });
    await typeAmount(tree, '120');
    await save(tree);
    expect(createTransaction).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: 'cash' }));
  });

  it('queues only once when Add to list is tapped during repeat detection', async () => {
    let finish!: (result: null) => void;
    (findRecentRepeat as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<null>((resolve) => {
          finish = resolve;
        })
    );
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '120');
    const button = pressable(tree, 'Add more');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    await act(async () => {
      finish(null);
      await settle();
    });
    await save(tree, 'Save 1 entry');
    expect(createTransaction).toHaveBeenCalledTimes(1);
  });

  it('counts both the queued entry and populated current form', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '120');
    await press(tree, 'Add more');
    await typeAmount(tree, '40');
    await save(tree, 'Save 2 entries');
    expect(createTransaction).toHaveBeenCalledTimes(2);
  });

  it('hides and reopens the number pad without losing the amount', async () => {
    const tree = await render();
    await typeAmount(tree, '120');
    await pressLabelled(tree, 'Hide pad');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'delete')).toHaveLength(0);
    await press(tree, 'Show pad');
    expect(texts(tree)).toContain('120');
  });

  it('folds the pad away when a category is picked after an amount, and Save names the amount', async () => {
    const tree = await render();
    await typeAmount(tree, '250');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'delete').length).toBeGreaterThan(0);
    // The card says "Amount", not the type again, and no line repeats the category and account.
    expect(texts(tree)).toContain('Amount');
    expect(texts(tree).some((t) => t.includes('Choose a category ·'))).toBe(false);
    await press(tree, 'Food');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'delete')).toHaveLength(0);
    expect(tree.root.find((n) => n.props.title === 'Save ₹250')).toBeTruthy();
    await press(tree, 'Show pad');
    expect(texts(tree).some((t) => t.includes('Food ·'))).toBe(false);
  });

  it('keeps the pad up when a category is picked before any amount', async () => {
    const tree = await render();
    await press(tree, 'Food');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'delete').length).toBeGreaterThan(0);
  });

  it('explains invalid calculations and disables Save', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '1÷0');
    expect(texts(tree)).toContain('Enter a positive amount. Check the calculation.');
    expect(tree.root.find((n) => isSaveTitle(n.props.title)).props.disabled).toBe(true);
    expect(texts(tree)).toContain('—');
  });
  it('opens with no category picked, even one saved before, but keeps the account', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'cash', categoryId: 'food' },
    });
    const tree = await render();
    await typeAmount(tree, '250');
    await save(tree);
    expect(texts(tree)).toContain('Pick a category');
    expect(createTransaction).not.toHaveBeenCalled();
    await press(tree, 'Food');
    await save(tree);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'cash', categoryId: 'food' })
    );
  });

  it('saves a new expense with the remembered account and the picked category, remembers them, and goes back', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'cash', categoryId: 'food' },
    });
    const tree = await render();
    // Add opens with no category picked; this entry is Food.
    await press(tree, 'Food');
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

  it('opens filled in from a notification reply or a Quick Add shortcut', async () => {
    mockParams.current = { amount: '25000', note: 'lunch', categoryId: 'food' };
    const tree = await render();
    await save(tree);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 25000, note: 'lunch', categoryId: 'food' })
    );
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
    const alert = jest.mocked(showAlert);
    const tree = await render();
    // Add opens with no category picked; this entry is Food.
    await press(tree, 'Food');

    await typeAmount(tree, '100');
    await press(tree, 'Add more');
    await typeAmount(tree, '200');
    await press(tree, 'Add more');
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
    await clearAmount(tree);
    await typeAmount(tree, '500');
    await save(tree, 'Save changes');

    expect(updateTransaction).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ amountMinor: 50000, categoryId: 'food', note: 'Dinner', date: '2026-09-20' })
    );
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('editing an entry on an archived account keeps it on that account, not the first one', async () => {
    mockParams.current = { id: 't1' };
    const listAccounts: jest.Mock = jest.requireMock('@/db/ledger').listAccounts;
    const usual = listAccounts.getMockImplementation();
    // The screen reloads on focus, so every load sees the archived accounts.
    listAccounts.mockImplementation(async () => [
      account('bank', 'Bank'),
      account('cash', 'Cash', 'cash'),
      { ...account('old', 'Old card'), archived: true },
      { ...account('gone', 'Other archived'), archived: true },
    ]);
    try {
      (getTransactionById as jest.Mock).mockResolvedValueOnce({
        id: 't1',
        type: 'expense',
        amountMinor: 45000,
        accountId: 'old',
        toAccountId: null,
        categoryId: 'food',
        note: 'Dinner',
        date: '2026-09-20',
      });
      const tree = await render();
      expect(listAccounts).toHaveBeenCalledWith(true);
      expect(texts(tree)).toContain('Old card');
      expect(texts(tree)).not.toContain('Other archived');
      await save(tree, 'Save changes');
      expect(updateTransaction).toHaveBeenCalledWith('t1', expect.objectContaining({ accountId: 'old' }));
    } finally {
      listAccounts.mockImplementation(usual);
    }
  });

  it("a saved split can't be switched to income: it says why and stays an expense", async () => {
    mockParams.current = { id: 't1' };
    (getTransactionById as jest.Mock).mockResolvedValueOnce({
      id: 't1',
      type: 'expense',
      amountMinor: 10000,
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'food',
      note: '',
      date: '2026-09-20',
      splitId: 's1',
    });
    const { getSplitParts } = jest.requireMock('@/db/splits');
    (getSplitParts as jest.Mock).mockResolvedValueOnce([
      { id: 't1', categoryId: 'food', amountMinor: 10000 },
      { id: 't2', categoryId: 'travel', amountMinor: 10000 },
    ]);
    const tree = await render();
    await press(tree, 'Income');
    expect(showAlert).toHaveBeenCalledWith("A split can't change type", expect.any(String));
    expect(texts(tree)).toContain('Split 2 ways');
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('deleting from the edit screen goes back and offers an undo that puts the entry back', async () => {
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
    const snapshot = { table: 'transactions', row: { id: 't1' } };
    (deleteTransaction as jest.Mock).mockResolvedValueOnce(snapshot);
    const tree = await render();
    act(() => mockHeaderRight.current!.props.onPress());
    const buttons = jest.mocked(showAlert).mock.calls[0][2]!;
    await act(async () => {
      await buttons.find((b) => b.text === 'Delete')!.onPress!();
    });
    expect(deleteTransaction).toHaveBeenCalledWith('t1');
    expect(tree.root.findAll((n) => n.props.done === true)).toHaveLength(0);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(mockShowUndo).toHaveBeenCalledWith('Moved to Recently deleted', expect.any(Function));
    await act(async () => mockShowUndo.mock.calls[0][1]());
    expect(restoreTransaction).toHaveBeenCalledWith(snapshot);
  });

  it('deleting a split from the edit screen undoes the whole split', async () => {
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
      splitId: 's1',
    });
    const snapshots = [{ table: 'transactions', row: { id: 't1' } }];
    (deleteSplit as jest.Mock).mockResolvedValueOnce(snapshots);
    await render();
    act(() => mockHeaderRight.current!.props.onPress());
    const buttons = jest.mocked(showAlert).mock.calls[0][2]!;
    await act(async () => {
      await buttons.find((b) => b.text === 'Delete')!.onPress!();
    });
    expect(deleteSplit).toHaveBeenCalledWith('s1');
    expect(mockShowUndo).toHaveBeenCalledWith('Split moved to Recently deleted', expect.any(Function));
    await act(async () => mockShowUndo.mock.calls[0][1]());
    expect(restoreSplit).toHaveBeenCalledWith(snapshots);
  });

  it('adds up a sum typed on the pad', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'bank', categoryId: 'food' },
    });
    const tree = await render();
    // Add opens with no category picked; this entry is Food.
    await press(tree, 'Food');
    await typeAmount(tree, '120+45');
    expect(texts(tree)).toEqual(expect.arrayContaining(['165', '120 + 45']));
    await save(tree);
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 16500 }));
  });

  it('warns about a likely repeat on the first Save, and saves on the second', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'bank', categoryId: 'food' },
    });
    (findRecentRepeat as jest.Mock).mockResolvedValue({ savedAt: '2026-09-26T08:22:00Z' });
    const tree = await render();
    // Add opens with no category picked; this entry is Food.
    await press(tree, 'Food');
    await typeAmount(tree, '50');
    await save(tree);
    expect(createTransaction).not.toHaveBeenCalled();
    expect(texts(tree).some((t) => t.startsWith('You added ₹50 · Food from Bank at'))).toBe(true);

    await save(tree, 'Save anyway');
    expect(createTransaction).toHaveBeenCalledTimes(1);
    (findRecentRepeat as jest.Mock).mockResolvedValue(null);
  });

  it('forgets the warning once the entry changes', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'bank', categoryId: 'food' },
    });
    (findRecentRepeat as jest.Mock).mockResolvedValueOnce({ savedAt: '2026-09-26T08:22:00Z' });
    const tree = await render();
    // Add opens with no category picked; this entry is Food.
    await press(tree, 'Food');
    await typeAmount(tree, '50');
    await save(tree);
    expect(texts(tree).some((t) => t.startsWith('You added'))).toBe(true);
    await typeAmount(tree, '0');
    expect(texts(tree).some((t) => t.startsWith('You added'))).toBe(false);
    expect(texts(tree).some(isSaveTitle)).toBe(true);
  });

  it('warns when the same entry is already on the list', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'bank', categoryId: 'food' },
    });
    const tree = await render();
    // Add opens with no category picked; this entry is Food.
    await press(tree, 'Food');
    await typeAmount(tree, '80');
    await press(tree, 'Add more');
    await typeAmount(tree, '80');
    await press(tree, 'Add more');
    expect(texts(tree)).toContain('₹80 · Food is already on your list below. Tap again to add it anyway.');
    expect(texts(tree)).toContain('1 staged');
  });

  it('uses the account the category was last used with, until you pick one yourself', async () => {
    (getLastAccountForCategory as jest.Mock).mockResolvedValue('cash');
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '60');
    await save(tree);
    expect(createTransaction).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: 'cash' }));

    const tree2 = await render();
    await act(async () => {
      tree2.root
        .find(
          (n) =>
            typeof n.props.accessibilityLabel === 'string' &&
            n.props.accessibilityLabel.startsWith('Account,') &&
            n.props.onPress
        )
        .props.onPress();
    });
    // The row in the Pay from sheet (the account chip on the detail bar can say "Bank" too).
    await act(async () => {
      tree2.root
        .find((n) => n.props.accessibilityLabel === 'Bank' && typeof n.props.onPress === 'function')
        .props.onPress();
      await settle();
    });
    await press(tree2, 'Food');
    await typeAmount(tree2, '60');
    await save(tree2);
    expect(createTransaction).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: 'bank' }));
    (getLastAccountForCategory as jest.Mock).mockResolvedValue(null);
  });

  it('offers to add a person right here when there is nobody yet', async () => {
    const everyone = await (listPeople as jest.Mock)();
    (listPeople as jest.Mock).mockResolvedValue([]);
    const tree = await render();
    await press(tree, 'Friend');
    expect(mockAddPersonVisible.current).toBe(false);
    await act(async () => {
      tree.root
        .find((n) => n.props.title === 'Add a person' && typeof n.props.onPress === 'function')
        .props.onPress();
    });
    expect(mockAddPersonVisible.current).toBe(true);
    (listPeople as jest.Mock).mockResolvedValue(everyone);
  });
  it('fills category, amount and account from a "Your usual" chip', async () => {
    (getRepeatEntries as jest.Mock).mockResolvedValue([
      {
        type: 'expense',
        accountId: 'cash',
        accountCurrency: 'INR',
        categoryId: 'rapido',
        categoryName: 'Rapido',
        categoryIcon: 'bike',
        categoryColor: '#8FCBFF',
        amountMinor: 12600,
        note: '',
        timesLogged: 3,
      },
    ]);
    const tree = await render();
    expect(texts(tree)).toContain('Your usual');
    // The chip's name and amount are separate texts, so the amount is never the part cut short.
    expect(texts(tree)).toEqual(expect.arrayContaining(['Rapido', '₹126']));
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Rapido, ₹126, logged 3 times' && n.props.onPress)
        .props.onPress();
    });
    await save(tree);
    expect(createTransaction).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: 'rapido', amountMinor: 12600, accountId: 'cash' })
    );
    (getRepeatEntries as jest.Mock).mockResolvedValue([]);
  });

  it('opens a transfer into the account a goal follows, from a different account', async () => {
    mockParams.current = { type: 'transfer', toAccountId: 'bank' };
    const tree = await render();
    await typeAmount(tree, '5000');
    await save(tree);
    expect(createTransaction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'transfer',
        accountId: 'cash',
        toAccountId: 'bank',
        amountMinor: 500000,
      })
    );
  });

  it('finds a subcategory by name without opening its parent', async () => {
    const tree = await render();
    expect(texts(tree)).not.toContain('Rapido');
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Find a category' && n.props.onChangeText)
        .props.onChangeText('rap');
    });
    expect(texts(tree)).toEqual(expect.arrayContaining(['Rapido', 'in Travel']));
    await press(tree, 'Rapido');
    await typeAmount(tree, '126');
    await save(tree);
    expect(createTransaction).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 'rapido' }));
  });

  it('brings the number pad back when the keyboard is closed while searching or writing a note', async () => {
    // Android can close the keyboard (back gesture, its own down key) without
    // the field ever losing focus — the screen hears it as keyboardDidHide.
    let hideKeyboard: () => void = () => {};
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, fn: () => void) => {
      if (event === 'keyboardDidHide') hideKeyboard = fn;
      return { remove: jest.fn() };
    }) as any);
    try {
      const tree = await render();
      const padKey = () => tree.root.findAll((n) => n.props.accessibilityLabel === '7' && n.props.onPress);
      expect(padKey().length).toBeGreaterThan(0);

      const search = tree.root.find(
        (n) => n.props.accessibilityLabel === 'Find a category' && n.props.onFocus
      );
      await act(async () => search.props.onFocus());
      expect(padKey()).toHaveLength(0);

      await act(async () => hideKeyboard());
      expect(padKey().length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Add screen — leaving with an unsaved entry', () => {
  it('protects a changed transfer destination and stops asking when reverted', async () => {
    mockParams.current = { id: 't1' };
    jest.mocked(getTransactionById).mockResolvedValueOnce({
      id: 't1',
      type: 'transfer',
      amountMinor: 45000,
      accountId: 'bank',
      toAccountId: 'cash',
      categoryId: null,
      note: '',
      date: '2026-09-20',
    } as never);
    const tree = await render();
    expect(mockGuard.prevent).toBe(false);
    act(() => tree.root.findByType(TransferAccounts).props.onPickTo('bank'));
    expect(mockGuard.prevent).toBe(true);
    act(() => tree.root.findByType(TransferAccounts).props.onPickTo('cash'));
    expect(mockGuard.prevent).toBe(false);
  });

  it('protects a changed refund flag', async () => {
    mockParams.current = { id: 't1' };
    jest.mocked(getTransactionById).mockResolvedValueOnce({
      id: 't1',
      type: 'expense',
      amountMinor: 45000,
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'food',
      note: '',
      date: '2026-09-20',
      isRefund: false,
    } as never);
    const tree = await render();
    expect(mockGuard.prevent).toBe(false);
    await pressLabelled(tree, 'Money back (a refund)');
    expect(mockGuard.prevent).toBe(true);
    await pressLabelled(tree, 'Money back (a refund)');
    expect(mockGuard.prevent).toBe(false);
  });

  it('protects split allocation changes returned from the split editor', async () => {
    mockParams.current = { id: 't1' };
    jest.mocked(getTransactionById).mockResolvedValueOnce({
      id: 't1',
      type: 'expense',
      amountMinor: 10000,
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'food',
      note: '',
      date: '2026-09-20',
      splitId: 's1',
    } as never);
    jest.mocked(getSplitParts).mockResolvedValueOnce([
      { id: 't1', categoryId: 'food', amountMinor: 10000 },
      { id: 't2', categoryId: 'travel', amountMinor: 10000 },
    ] as never);
    const tree = await render();
    expect(mockGuard.prevent).toBe(false);
    // The focus hook runs again when load's route dependency changes, as on return from Split.
    finishSplitSession([
      { key: 'new-a', categoryId: 'food', amountText: '' },
      { key: 'new-b', categoryId: 'travel', amountText: '120' },
    ]);
    mockParams.current = { id: 't1', note: 'focus' };
    await act(async () => {
      tree.update(<AddTransactionScreen />);
      await settle();
    });
    expect(mockGuard.prevent).toBe(true);
    act(() => tree.unmount());
  });

  it('protects changes to an existing split amount', async () => {
    mockParams.current = { id: 't1' };
    jest.mocked(getTransactionById).mockResolvedValueOnce({
      id: 't1',
      type: 'expense',
      amountMinor: 10000,
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'food',
      note: '',
      date: '2026-09-20',
      splitId: 's1',
    } as never);
    jest.mocked(getSplitParts).mockResolvedValueOnce([
      { id: 't1', categoryId: 'food', amountMinor: 10000 },
      { id: 't2', categoryId: 'travel', amountMinor: 10000 },
    ] as never);
    const tree = await render();
    expect(mockGuard.prevent).toBe(false);
    await clearAmount(tree);
    await typeAmount(tree, '300');
    expect(mockGuard.prevent).toBe(true);
  });

  it('lets a blank new entry go, and asks once something is typed', async () => {
    const tree = await render();
    expect(mockGuard.prevent).toBe(false);
    await typeAmount(tree, '120');
    expect(mockGuard.prevent).toBe(true);
  });

  it('stops asking once the amount is cleared again', async () => {
    const tree = await render();
    await typeAmount(tree, '5');
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'delete' && typeof n.props.onLongPress === 'function')
        .props.onLongPress();
    });
    expect(mockGuard.prevent).toBe(false);
  });

  it('Keep editing stays; Discard dispatches the blocked action and leaves', async () => {
    const tree = await render();
    await typeAmount(tree, '120');
    const action = { type: 'GO_BACK' };
    act(() => mockGuard.onBlocked({ data: { action } }));
    const alert = jest.mocked(showAlert);
    expect(alert).toHaveBeenCalledWith('Leave this entry?', expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((b) => b.text)).toEqual(['Keep editing', 'Keep draft', 'Discard']);

    await act(async () => buttons.find((b) => b.text === 'Keep editing')!.onPress?.());
    expect(mockDispatch).not.toHaveBeenCalled();

    await act(async () => buttons.find((b) => b.text === 'Discard')!.onPress!());
    expect(mockDispatch).toHaveBeenCalledWith(action);
    expect(mockGuard.prevent).toBe(false);
  });

  it('does not ask after a save', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'cash', categoryId: 'food' },
    });
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '120');
    expect(mockGuard.prevent).toBe(true);
    await save(tree);
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(mockGuard.prevent).toBe(false);
  });

  it('does not ask on an unchanged edit', async () => {
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
    await render();
    expect(mockGuard.prevent).toBe(false);
  });
});

describe('Add screen — money back', () => {
  it('saves a refund as money in, against the spending category, and says so on the card', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'bank', categoryId: 'food' },
    });
    const tree = await render();
    // Add opens with no category picked; this entry is Food.
    await press(tree, 'Food');
    await typeAmount(tree, '250');
    await act(async () => {
      tree.root
        .find(
          (n) =>
            n.props.accessibilityLabel === 'Money back (a refund)' && typeof n.props.onPress === 'function'
        )
        .props.onPress();
    });
    expect(texts(tree)).toContain('Money back');
    await save(tree, 'Save refund');
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', isRefund: true, categoryId: 'food', amountMinor: 25000 })
    );
  });

  it('opens as a refund from "Got money back", with the category and note filled in', async () => {
    mockParams.current = {
      type: 'expense',
      refund: '1',
      categoryId: 'food',
      accountId: 'bank',
      note: 'Amazon return',
    };
    const tree = await render();
    await typeAmount(tree, '100');
    await save(tree, 'Save refund');
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', isRefund: true, categoryId: 'food', note: 'Amazon return' })
    );
  });
  it('opens the split page with this payment, its category holding all of it', async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'cash', categoryId: 'food' },
    });
    const tree = await render();
    // Add opens with no category picked; this entry is Food.
    await press(tree, 'Food');
    await typeAmount(tree, '2400');
    await act(async () => {
      tree.root
        .find(
          (n) => n.props.accessibilityLabel === 'Split this payment' && typeof n.props.onPress === 'function'
        )
        .props.onPress();
    });
    expect(router.push).toHaveBeenCalledWith('/split');
    const session = getSplitSession()!;
    expect(session.totalMinor).toBe(240000);
    expect(session.meta).toBe('Cash · Today');
    expect(session.parts.map((p) => p.categoryId)).toEqual(['food']);
    expect(session.categories.every((c) => c.kind === 'expense')).toBe(true);
  });

  it("takes the split page's parts back on Done and saves them as one split", async () => {
    (getAddDefaults as jest.Mock).mockResolvedValueOnce({
      expense: { accountId: 'cash', categoryId: 'food' },
    });
    mockParams.current = { amount: '240000' };
    openSplitSession({ totalMinor: 240000, currency: 'INR', meta: '', categories: [], parts: [] });
    finishSplitSession([
      { key: 'a', categoryId: 'food', amountText: '' },
      { key: 'b', categoryId: 'travel', amountText: '500' },
    ]);
    const tree = await render();
    expect(texts(tree)).toContain('Split 2 ways');
    await save(tree, 'Save split');
    expect(saveSplit).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'cash',
        parts: [
          { categoryId: 'food', amountMinor: 190000 },
          { categoryId: 'travel', amountMinor: 50000 },
        ],
      })
    );
  });
});

it('keeps invalid actions visibly disabled and preserves pad hide/show and valid saving', async () => {
  const tree = await render();
  const saveButton = () =>
    tree.root.find((n) => isSaveTitle(n.props.title) && typeof n.props.onPress === 'function');
  expect(saveButton().props.disabled).toBe(true);
  expect(pressable(tree, 'Add more').props.disabled).toBe(true);
  await pressLabelled(tree, 'Hide pad');
  await press(tree, 'Show pad');
  await press(tree, 'Food');
  await typeAmount(tree, '120');
  expect(saveButton().props.disabled).toBe(false);
  expect(pressable(tree, 'Add more').props.disabled).toBe(false);
});

it('resumes an unfinished entry only after a tap and clears its draft after saving', async () => {
  const { readEntryDraft, writeEntryDraft } = require('@/db/entryDraft');
  readEntryDraft.mockResolvedValueOnce({
    type: 'expense',
    expr: '270',
    accountId: 'cash',
    toAccountId: 'unused-transfer-account',
    categoryId: 'food',
    note: 'Recovered lunch',
    paymentMode: 'upi',
    date: '2026-10-19',
    personId: 'unused-person',
    friendSign: 1,
    friendAccountId: 'unused-friend-account',
    refund: false,
    rows: [],
    splitParts: null,
  });
  const tree = await render();
  try {
    expect(texts(tree)).toContain('Continue your unfinished entry?');
    expect(createTransaction).not.toHaveBeenCalled();
    await press(tree, 'Resume draft');
    await save(tree);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 27000,
        accountId: 'cash',
        categoryId: 'food',
        date: '2026-10-19',
        paymentMode: 'upi',
        note: 'Recovered lunch',
      })
    );
    expect(writeEntryDraft).toHaveBeenCalledWith(null);
  } finally {
    act(() => tree.unmount());
  }
});

it('keeps account selection without showing payment-method controls', async () => {
  const tree = await render();
  try {
    expect(JSON.stringify(tree.toJSON())).not.toContain('Payment method');
    expect(JSON.stringify(tree.toJSON())).not.toContain('Not recorded');
    expect(JSON.stringify(tree.toJSON())).toContain('Bank');
  } finally {
    act(() => tree.unmount());
  }
});

it('confirms a far-future staged entry even when the current form date was changed back', async () => {
  const { AddSheets } = require('./AddSheets');
  const { toLocalIsoDate, addDaysToIsoDate } = require('@/lib/date');
  const today = toLocalIsoDate(new Date());
  const future = addDaysToIsoDate(today, 8);
  const tree = await render();
  try {
    await press(tree, 'Food');
    await typeAmount(tree, '100');
    act(() => tree.root.findByType(AddSheets).props.calendar.onPick(future));
    await press(tree, 'Add more');
    act(() => tree.root.findByType(AddSheets).props.calendar.onPick(today));
    await save(tree, 'Save 1 entry');
    expect(createTransaction).not.toHaveBeenCalled();
    expect(jest.mocked(showAlert).mock.calls.some(([title]) => title.startsWith('Save it for'))).toBe(true);
  } finally {
    act(() => tree.unmount());
  }
});

it('treats a split as saved even if its optional highlight lookup fails', async () => {
  mockParams.current = { amount: '10000' };
  openSplitSession({ totalMinor: 10000, currency: 'INR', meta: '', categories: [], parts: [] });
  finishSplitSession([
    { key: 'a', categoryId: 'food', amountText: '' },
    { key: 'b', categoryId: 'travel', amountText: '40' },
  ]);
  const tree = await render();
  try {
    jest
      .mocked(require('@/db/splits').getSplitParts)
      .mockRejectedValueOnce(new Error('read failed after commit'));
    await save(tree, 'Save split');
    expect(saveSplit).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalled();
    expect(texts(tree)).not.toContain('read failed after commit');
  } finally {
    act(() => tree.unmount());
  }
});

it('keeps the form and writes no money if save preparation fails, then permits a safe retry', async () => {
  const { writeEntryDraft } = require('@/db/entryDraft');
  const previous = writeEntryDraft.getMockImplementation();
  let fail = true;
  writeEntryDraft.mockImplementation(async (value: unknown) => {
    if (value === null && fail) {
      fail = false;
      throw new Error('draft storage unavailable');
    }
  });
  mockParams.current = { amount: '10000', categoryId: 'food' };
  const tree = await render();
  try {
    await save(tree);
    expect(createTransaction).not.toHaveBeenCalled();
    expect(texts(tree).join(' ')).toContain('Couldn’t prepare this save');
    await save(tree);
    expect(createTransaction).toHaveBeenCalledTimes(1);
  } finally {
    act(() => tree.unmount());
    writeEntryDraft.mockImplementation(previous);
  }
});

it('does not navigate back again when a save completes after leaving Add', async () => {
  const changed = jest.spyOn(require('@/lib/dataEvents'), 'emitTransactionsChanged');
  let finish!: (value: unknown) => void;
  jest.mocked(createTransaction).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve as typeof finish;
      })
  );
  mockParams.current = { amount: '10000', categoryId: 'food' };
  const tree = await render();
  let pending!: Promise<void>;
  await act(async () => {
    const saveButton = tree.root.find(
      (n) => isSaveTitle(n.props.title) && typeof n.props.onPress === 'function'
    );
    pending = saveButton.props.onPress();
    await settle();
  });
  act(() => tree.unmount());
  await act(async () => {
    finish({ id: 'saved-after-leave' });
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
  expect(createTransaction).toHaveBeenCalledTimes(1);
  expect(router.back).not.toHaveBeenCalled();
  expect(changed).toHaveBeenCalledTimes(1);
  changed.mockRestore();
});
