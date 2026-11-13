/**
 * The Add screen against a real database: whatever is typed and picked is read back from the saved rows, and the
 * balances are checked, so a mismatch between the form and what is stored shows up here and not on a phone.
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

jest.setTimeout(60000);

let mockDb: ReturnType<typeof createRealDataTestDb>;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));
jest.mock('@/db/entryDraft', () => ({
  readEntryDraft: jest.fn(async () => null),
  writeEntryDraft: jest.fn(async () => {}),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: require('react-native').View,
  KeyboardProvider: ({ children }: { children: unknown }) => children,
  useKeyboardState: () => false,
  KeyboardAwareScrollView: require('react-native').View,
  KeyboardStickyView: require('react-native').View,
}));
// Keeps the header's right-hand button so a test can press it (the bin on an edit).
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
const mockCalendar: { current: { onPick: (iso: string) => void } | null } = { current: null };
jest.mock('@/components/CalendarSheet', () => ({
  CalendarSheet: (props: { onPick: (iso: string) => void }) => {
    mockCalendar.current = props;
    return null;
  },
}));
jest.mock('@/features/home/RepeatEntrySheet', () => ({ RepeatEntrySheet: () => null }));
jest.mock('@/features/people/AddPersonModal', () => ({ AddPersonModal: () => null }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => {} }));
const mockParams: { current: Record<string, string | undefined> } = { current: {} };
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: (...a: unknown[]) => mockBack(...a), push: jest.fn() },
  useNavigation: () => ({ dispatch: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
const mockAlert = jest.fn();
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));

import AddTransactionScreen from '../../../app/add-transaction';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { createPerson } from '@/db/people';
import { archiveAccount, getAccountBalance } from '@/db/accounts';
import { archiveCategory } from '@/db/categories';
import { resetSettingsCache, setDefaultCurrency } from '@/db/settings';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';

const today = toLocalIsoDate(new Date());
let ids: { bank: string; cash: string; pot: string; food: string; salary: string; person: string };

beforeEach(async () => {
  mockBack.mockClear();
  mockAlert.mockClear();
  mockShowUndo.mockClear();
  mockHeaderRight.current = null;
  mockParams.current = {};
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  await setDefaultCurrency('INR');
  const bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1_000_000 })
  ).id;
  const cash = (
    await createAccount({ name: 'Cash', type: 'cash', currency: 'INR', openingBalanceMinor: 100_000 })
  ).id;
  const pot = (
    await createAccount({ name: 'Pot', type: 'savings', currency: 'INR', openingBalanceMinor: 500_000 })
  ).id;
  const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  const salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
  const person = (await createPerson({ name: 'Aarav' })).id;
  // The built-in categories Friends & Family entries are filed under (a fresh install has them seeded).
  await createCategory({ name: 'Friends & Family', kind: 'expense' });
  await createCategory({ name: 'Friends & Family', kind: 'income' });
  await mockDb.runAsync("UPDATE categories SET is_system = 1 WHERE name = 'Friends & Family'");
  ids = { bank, cash, pot, food, salary, person };
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AddTransactionScreen />);
  });
  await act(settle);
  await act(settle);
  return tree;
}
const textOf = (n: ReactTestInstance) => [].concat(n.props.children).join('');
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map(textOf);
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
const KEY_LABEL: Record<string, string> = {
  '.': 'decimal point',
  '+': 'plus',
  '−': 'minus',
  '×': 'times',
  '÷': 'divide',
};
async function typeAmount(tree: ReactTestRenderer, value: string) {
  for (const ch of value) {
    await act(async () => {
      tree.root
        .find(
          (n) => n.props.accessibilityLabel === (KEY_LABEL[ch] ?? ch) && typeof n.props.onPress === 'function'
        )
        .props.onPress();
    });
  }
}
const isSaveTitle = (t?: string) => t === 'Save' || !!t?.startsWith('Save');
async function save(tree: ReactTestRenderer) {
  await act(async () => {
    await tree.root
      .find((n) => isSaveTitle(n.props.title) && typeof n.props.onPress === 'function')
      .props.onPress();
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
}
interface Row {
  type: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  amount_minor: number;
  date: string;
  note: string;
  is_refund: number;
}
const saved = () =>
  mockDb.getAllAsync<Row>(
    'SELECT type, account_id, to_account_id, category_id, amount_minor, date, note, is_refund FROM transactions ORDER BY created_at, id'
  );

describe('saving an entry', () => {
  it('stores an expense exactly as picked: amount, category, account, today, and takes it off the balance', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '250');
    await save(tree);
    expect(await saved()).toEqual([
      expect.objectContaining({
        type: 'expense',
        category_id: ids.food,
        amount_minor: 25_000,
        date: today,
        note: '',
        to_account_id: null,
        is_refund: 0,
      }),
    ]);
    const row = (await saved())[0];
    expect([ids.bank, ids.cash]).toContain(row.account_id);
    const opening = row.account_id === ids.bank ? 1_000_000 : 100_000;
    expect(await getAccountBalance(row.account_id)).toBe(opening - 25_000);
    expect(mockBack).toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('stores a sum typed on the pad as its total', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '120+45×2');
    await save(tree);
    expect((await saved()).map((r) => r.amount_minor)).toEqual([21_000]);
    act(() => tree.unmount());
  });

  it('keeps whole rupees: a typed 1500.5 is saved as 1,501 and the card said so first', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '1500.5');
    expect(texts(tree).some((t) => t.includes('1,501'))).toBe(true);
    await save(tree);
    expect((await saved()).map((r) => r.amount_minor)).toEqual([150_100]);
    act(() => tree.unmount());
  });

  it('refuses a nothing amount, says why, and saves nothing', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '0.4');
    await save(tree);
    expect(await saved()).toEqual([]);
    expect(mockBack).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('saves one entry for a double tap on Save', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '99');
    await act(async () => {
      const button = tree.root.find(
        (n) => isSaveTitle(n.props.title) && typeof n.props.onPress === 'function'
      );
      button.props.onPress();
      button.props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(await saved()).toHaveLength(1);
    act(() => tree.unmount());
  });

  it('files income as money in against its category', async () => {
    const tree = await render();
    await press(tree, 'Income');
    await press(tree, 'Salary');
    await typeAmount(tree, '80000');
    await save(tree);
    const rows = await saved();
    expect(rows).toEqual([
      expect.objectContaining({
        type: 'income',
        category_id: ids.salary,
        amount_minor: 8_000_000,
        is_refund: 0,
      }),
    ]);
    expect(await getAccountBalance(rows[0].account_id)).toBeGreaterThan(
      rows[0].account_id === ids.bank ? 1_000_000 : 100_000
    );
    act(() => tree.unmount());
  });

  it('writes an income note as typed', async () => {
    const tree = await render();
    await press(tree, 'Income');
    await press(tree, 'Salary');
    await typeAmount(tree, '500');
    await act(async () => {
      tree.root.find((n) => n.props.accessibilityLabel === 'Add a note' && n.props.onPress).props.onPress();
    });
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Note' && n.props.onChangeText)
        .props.onChangeText('October bonus');
    });
    await save(tree);
    expect((await saved())[0].note).toBe('October bonus');
    act(() => tree.unmount());
  });

  it('writes an expense label as picked from its sheet', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '60');
    await act(async () => {
      tree.root.find((n) => n.props.accessibilityLabel === 'Add a label' && n.props.onPress).props.onPress();
    });
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Expense label' && n.props.onChangeText)
        .props.onChangeText('Lunch with Priya');
    });
    await act(async () => {
      await tree.root
        .find((n) => n.props.accessibilityLabel === 'Expense label' && n.props.onSubmitEditing)
        .props.onSubmitEditing();
      await settle();
    });
    await save(tree);
    expect((await saved())[0].note).toBe('Lunch with Priya');
    act(() => tree.unmount());
  });
});

describe('transfers, refunds and friends', () => {
  it('moves money between two accounts: one entry, one balance down and the other up, no category', async () => {
    mockParams.current = { type: 'transfer', accountId: ids.bank, toAccountId: ids.pot };
    const tree = await render();
    await typeAmount(tree, '5000');
    await save(tree);
    expect(await saved()).toEqual([
      expect.objectContaining({
        type: 'transfer',
        account_id: ids.bank,
        to_account_id: ids.pot,
        category_id: null,
        amount_minor: 500_000,
      }),
    ]);
    expect(await getAccountBalance(ids.bank)).toBe(1_000_000 - 500_000);
    expect(await getAccountBalance(ids.pot)).toBe(500_000 + 500_000);
    act(() => tree.unmount());
  });

  it('saves money back as income against the purchase’s category, flagged as a refund', async () => {
    mockParams.current = {
      type: 'expense',
      refund: '1',
      accountId: ids.bank,
      categoryId: ids.food,
      note: 'Shoes',
    };
    const tree = await render();
    await typeAmount(tree, '300');
    await save(tree);
    expect(await saved()).toEqual([
      expect.objectContaining({
        type: 'income',
        is_refund: 1,
        category_id: ids.food,
        amount_minor: 30_000,
        account_id: ids.bank,
        note: 'Shoes',
      }),
    ]);
    act(() => tree.unmount());
  });

  it('offers no savings account to spend from, only to move money into or out of', async () => {
    const tree = await render();
    await act(async () => {
      tree.root
        .find((n) => String(n.props.accessibilityLabel).startsWith('Account,') && n.props.onPress)
        .props.onPress();
    });
    const names = tree.root
      .findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          /^(Bank|Cash|Pot)\b/.test(n.props.accessibilityLabel)
      )
      .map((n) => String(n.props.accessibilityLabel).split(',')[0]);
    expect(names).toEqual(expect.arrayContaining(['Bank', 'Cash']));
    expect(names).not.toContain('Pot');
    act(() => tree.unmount());
  });
});

describe('the date', () => {
  const pickDate = async (iso: string) => {
    await act(async () => {
      mockCalendar.current!.onPick(iso);
    });
  };

  it('stores the date that was picked', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '40');
    await pickDate(addDaysToIsoDate(today, -1));
    expect(texts(tree)).toContain('Yesterday');
    await save(tree);
    expect((await saved())[0].date).toBe(addDaysToIsoDate(today, -1));
    act(() => tree.unmount());
  });

  it('names the year on the date chip once it is not this year, so a wrong-year pick is visible before saving', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '40');
    const lastYear = `${new Date().getFullYear() - 1}-${today.slice(5)}`;
    await pickDate(lastYear);
    const chip = tree.root.find(
      (n) => String(n.props.accessibilityLabel).startsWith('Date,') && typeof n.props.onPress === 'function'
    );
    expect(chip.props.accessibilityLabel).toContain(String(new Date().getFullYear() - 1));
    expect(texts(tree).some((t) => t.includes(String(new Date().getFullYear() - 1)))).toBe(true);
    // A date in this year stays short.
    await pickDate(addDaysToIsoDate(today, -2));
    expect(
      tree.root.find((n) => String(n.props.accessibilityLabel).startsWith('Date,') && n.props.onPress).props
        .accessibilityLabel
    ).not.toContain(String(new Date().getFullYear()));
    act(() => tree.unmount());
  });

  it('asks before saving a date more than a week ahead, and names the year, since a wrong year is what it is for', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '40');
    const next = `${new Date().getFullYear() + 1}-${today.slice(5)}`;
    await pickDate(next);
    await save(tree);
    // Nothing is saved until it is confirmed.
    expect(await saved()).toEqual([]);
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const [title, body] = mockAlert.mock.calls[0];
    expect(title).toContain(String(new Date().getFullYear() + 1));
    // And how far off it is, so a year ahead cannot be read as "soon".
    expect(body).toMatch(/^That’s 3\d\d days from today\.$/);
    act(() => tree.unmount());
  });

  it('saves the far date once it is confirmed, and not before', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '40');
    const next = addDaysToIsoDate(today, 30);
    await pickDate(next);
    await save(tree);
    expect(await saved()).toEqual([]);
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((b) => b.text === 'Save')!.onPress!();
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect((await saved()).map((r) => r.date)).toEqual([next]);
    act(() => tree.unmount());
  });
});

describe('editing an entry', () => {
  async function entry(over: Partial<Parameters<typeof createTransaction>[0]> = {}) {
    return createTransaction({
      type: 'expense',
      accountId: ids.bank,
      categoryId: ids.food,
      amountMinor: 247_967,
      date: addDaysToIsoDate(today, -3),
      note: 'Dinner',
      ...over,
    });
  }
  const only = async () => (await saved())[0];

  it('keeps the exact amount, paise and all, when only the note is changed', async () => {
    const tx = await entry();
    mockParams.current = { id: tx.id };
    const tree = await render();
    await act(async () => {
      tree.root
        .find((n) => String(n.props.accessibilityLabel).startsWith('Label,') && n.props.onPress)
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Expense label' && n.props.onChangeText)
        .props.onChangeText('Dinner out');
    });
    await act(async () => {
      await tree.root
        .find((n) => n.props.accessibilityLabel === 'Expense label' && n.props.onSubmitEditing)
        .props.onSubmitEditing();
      await settle();
    });
    await save(tree);
    expect(await only()).toEqual(expect.objectContaining({ amount_minor: 247_967, note: 'Dinner out' }));
    act(() => tree.unmount());
  });

  it('changes the amount to whole rupees when the amount is edited, and keeps everything else', async () => {
    const tx = await entry();
    mockParams.current = { id: tx.id };
    const tree = await render();
    await act(async () => {
      tree.root
        .find((n) => String(n.props.accessibilityLabel).startsWith('Amount,') && n.props.onPress)
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'delete' && typeof n.props.onLongPress === 'function')
        .props.onLongPress();
    });
    await typeAmount(tree, '300');
    await save(tree);
    expect(await only()).toEqual(
      expect.objectContaining({
        amount_minor: 30_000,
        category_id: ids.food,
        account_id: ids.bank,
        note: 'Dinner',
        date: addDaysToIsoDate(today, -3),
      })
    );
    // The balance follows the edit: the old amount is given back, the new one taken.
    expect(await getAccountBalance(ids.bank)).toBe(1_000_000 - 30_000);
    act(() => tree.unmount());
  });

  it('turns an expense into income without leaving it in a category of the wrong kind', async () => {
    const tx = await entry();
    mockParams.current = { id: tx.id };
    const tree = await render();
    await press(tree, 'Income');
    await press(tree, 'Salary');
    await save(tree);
    const row = await only();
    expect(row.type).toBe('income');
    expect(row.category_id).toBe(ids.salary);
    act(() => tree.unmount());
  });
});

describe('friend entries', () => {
  const ledger = () =>
    mockDb.getAllAsync<{ amount_minor: number; transaction_id: string | null }>(
      'SELECT amount_minor, transaction_id FROM person_ledger_entries ORDER BY created_at, id'
    );
  async function friend(tree: ReactTestRenderer, direction: 'They owe more' | 'They repaid', cash: string) {
    await press(tree, 'Friend');
    await press(tree, 'Aarav');
    await press(tree, direction);
    await press(tree, cash);
  }

  it('adjusts only the balance, with no transaction, when no cash moved', async () => {
    const tree = await render();
    await friend(tree, 'They owe more', 'Balance only');
    await typeAmount(tree, '1000');
    await save(tree);
    expect(await ledger()).toEqual([{ amount_minor: 100_000, transaction_id: null }]);
    expect(await saved()).toEqual([]);
    act(() => tree.unmount());
  });

  it('records money lent as an expense on the account and the same amount owed to you', async () => {
    const tree = await render();
    await friend(tree, 'They owe more', 'Bank');
    await typeAmount(tree, '1000');
    await save(tree);
    const rows = await saved();
    expect(rows).toEqual([
      expect.objectContaining({ type: 'expense', account_id: ids.bank, amount_minor: 100_000 }),
    ]);
    expect(await getAccountBalance(ids.bank)).toBe(1_000_000 - 100_000);
    const entries = await ledger();
    expect(entries).toHaveLength(1);
    expect(entries[0].amount_minor).toBe(100_000);
    expect(entries[0].transaction_id).not.toBeNull();
    act(() => tree.unmount());
  });

  it('records a repayment as income on the account and takes it off what they owe', async () => {
    const tree = await render();
    await friend(tree, 'They repaid', 'Cash');
    await typeAmount(tree, '400');
    await save(tree);
    expect(await saved()).toEqual([
      expect.objectContaining({ type: 'income', account_id: ids.cash, amount_minor: 40_000 }),
    ]);
    expect(await getAccountBalance(ids.cash)).toBe(100_000 + 40_000);
    expect((await ledger())[0].amount_minor).toBe(-40_000);
    act(() => tree.unmount());
  });
});

describe('several entries at once', () => {
  it('saves every staged entry and the one being typed, each as entered', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '100');
    await press(tree, 'Add more');
    await typeAmount(tree, '250');
    await save(tree);
    expect((await saved()).map((r) => r.amount_minor).sort()).toEqual([10_000, 25_000]);
    expect(mockBack).toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('keeps only what did not save, and says how many did, when one fails part-way, so a retry does not double up', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '100');
    await press(tree, 'Add more');
    await typeAmount(tree, '250');
    await press(tree, 'Add more');
    await typeAmount(tree, '375');
    // The second insert fails.
    const original = mockDb.runAsync.bind(mockDb);
    let inserts = 0;
    const spy = jest.spyOn(mockDb, 'runAsync').mockImplementation(async (sql: string, ...rest: unknown[]) => {
      if (/INSERT INTO transactions/i.test(sql) && ++inserts === 2) throw new Error('disk full');
      return original(sql, ...(rest as []));
    });
    try {
      await save(tree);
    } finally {
      spy.mockRestore();
    }
    expect((await saved()).map((r) => r.amount_minor)).toEqual([10_000]);
    expect(mockBack).not.toHaveBeenCalled();
    const [title, body] = mockAlert.mock.calls.at(-1)!;
    expect(title).toBe('Only some entries saved');
    expect(body).toContain('1 of 3 saved');
    // What is left is what did not save, and saving it now adds exactly that, once each.
    await save(tree);
    expect((await saved()).map((r) => r.amount_minor).sort()).toEqual([10_000, 25_000, 37_500]);
    act(() => tree.unmount());
  });
});

describe('the same entry twice', () => {
  it('warns before saving an entry identical to one just saved, and saves it only when asked again', async () => {
    const first = await render();
    await press(first, 'Food');
    await typeAmount(first, '180');
    await save(first);
    act(() => first.unmount());
    expect(await saved()).toHaveLength(1);

    const again = await render();
    await press(again, 'Food');
    await typeAmount(again, '180');
    await save(again);
    expect(await saved()).toHaveLength(1);
    expect(again.root.findAll((n) => n.props.title === 'Save anyway').length).toBeGreaterThan(0);
    await save(again);
    expect(await saved()).toHaveLength(2);
    act(() => again.unmount());
  });
});

describe('deleting from the edit screen', () => {
  it('removes the entry, gives the money back to the account, and Undo restores it', async () => {
    const tx = await createTransaction({
      type: 'expense',
      accountId: ids.bank,
      categoryId: ids.food,
      amountMinor: 50_000,
      date: today,
      note: 'Taxi',
    });
    expect(await getAccountBalance(ids.bank)).toBe(950_000);
    mockParams.current = { id: tx.id };
    const tree = await render();
    expect(mockHeaderRight.current).not.toBeNull();
    await act(async () => {
      mockHeaderRight.current!.props.onPress();
      await settle();
    });
    // A bin asks once more before it deletes (the screen's own confirmation).
    const confirm = mockAlert.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[] | undefined;
    if (confirm) {
      await act(async () => {
        confirm.find((b) => /delete/i.test(b.text))!.onPress!();
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
    } else {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
    }
    expect(await saved()).toEqual([]);
    expect(await getAccountBalance(ids.bank)).toBe(1_000_000);
    expect(mockShowUndo).toHaveBeenCalled();
    await act(async () => {
      await mockShowUndo.mock.calls.at(-1)![1]();
    });
    expect((await saved()).map((r) => r.amount_minor)).toEqual([50_000]);
    expect(await getAccountBalance(ids.bank)).toBe(950_000);
    act(() => tree.unmount());
  });
});

describe('editing an entry whose account or category has since been archived', () => {
  async function editNote(txId: string, note: string) {
    mockParams.current = { id: txId };
    const tree = await render();
    await act(async () => {
      tree.root
        .find((n) => String(n.props.accessibilityLabel).startsWith('Label,') && n.props.onPress)
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Expense label' && n.props.onChangeText)
        .props.onChangeText(note);
    });
    await act(async () => {
      await tree.root
        .find((n) => n.props.accessibilityLabel === 'Expense label' && n.props.onSubmitEditing)
        .props.onSubmitEditing();
      await settle();
    });
    await save(tree);
    act(() => tree.unmount());
  }

  it('leaves the entry on its own account instead of moving it to another', async () => {
    const old = (
      await createAccount({ name: 'Old card', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    const tx = await createTransaction({
      type: 'expense',
      accountId: old,
      categoryId: ids.food,
      amountMinor: 30_000,
      date: today,
      note: 'Fuel',
    });
    await archiveAccount(old);
    await editNote(tx.id, 'Fuel stop');
    const row = (await saved())[0];
    expect(row.account_id).toBe(old);
    expect(row.note).toBe('Fuel stop');
  });

  it('leaves the entry in its own category instead of clearing or replacing it', async () => {
    const gym = (await createCategory({ name: 'Gym', kind: 'expense' })).id;
    const tx = await createTransaction({
      type: 'expense',
      accountId: ids.bank,
      categoryId: gym,
      amountMinor: 30_000,
      date: today,
      note: 'Month',
    });
    await archiveCategory(gym);
    await editNote(tx.id, 'Month, paid late');
    const row = (await saved())[0];
    expect(row.category_id).toBe(gym);
    expect(row.note).toBe('Month, paid late');
  });
});

describe('opened from a link with odd or stale parameters', () => {
  const open = async (params: Record<string, string>) => {
    mockParams.current = params;
    return render();
  };
  const amountShown = (tree: ReactTestRenderer) =>
    String(
      tree.root.find((n) => String(n.props.accessibilityLabel).startsWith('Amount,') && n.props.onPress).props
        .accessibilityLabel
    );

  it.each([
    ['not a number', 'abc'],
    ['negative', '-5000'],
    ['zero', '0'],
    ['huge', '99999999999999999999'],
    ['fractional', '1234.5'],
  ])('ignores an amount that is %s, rather than prefilling nonsense', async (_label, amount) => {
    const tree = await open({ type: 'expense', amount });
    expect(amountShown(tree)).not.toMatch(/NaN|Infinity|undefined|-/);
    act(() => tree.unmount());
  });

  it('prefills a good amount, given in minor units, as whole rupees', async () => {
    const tree = await open({ type: 'expense', amount: '250000' });
    expect(amountShown(tree)).toContain('2,500');
    act(() => tree.unmount());
  });

  it('falls back to an expense for a type it does not know, and still saves one', async () => {
    const tree = await open({ type: 'bogus' });
    expect(texts(tree)).toContain('Food');
    await press(tree, 'Food');
    await typeAmount(tree, '10');
    await save(tree);
    expect((await saved())[0].type).toBe('expense');
    act(() => tree.unmount());
  });

  it('ignores an account that does not exist, using one that does', async () => {
    const tree = await open({ type: 'expense', accountId: 'gone' });
    await press(tree, 'Food');
    await typeAmount(tree, '10');
    await save(tree);
    expect([ids.bank, ids.cash]).toContain((await saved())[0].account_id);
    act(() => tree.unmount());
  });

  it('never offers a transfer from an account to itself', async () => {
    const tree = await open({ type: 'transfer', accountId: ids.bank, toAccountId: ids.bank });
    await typeAmount(tree, '10');
    await save(tree);
    // It opens on a different destination (or saves nothing), never the same account twice.
    for (const row of await saved()) {
      expect(row.type).toBe('transfer');
      expect(row.to_account_id).not.toBe(row.account_id);
    }
    act(() => tree.unmount());
  });

  it('ignores a category of the wrong kind for the type, instead of filing income under an expense category', async () => {
    const tree = await open({ type: 'income', categoryId: ids.food });
    await typeAmount(tree, '10');
    await save(tree);
    // Nothing is saved without picking an income category.
    expect(await saved()).toEqual([]);
    act(() => tree.unmount());
  });

  it('tells you, and goes back on OK, when the entry being edited no longer exists, rather than saving a new one', async () => {
    const tree = await open({ id: 'no-such-entry' });
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0][0]).toBe('This entry no longer exists');
    const ok = (mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find(
      (b) => b.text === 'OK'
    )!;
    act(() => ok.onPress!());
    expect(mockBack).toHaveBeenCalled();
    // Nothing was created in the meantime.
    expect(await saved()).toEqual([]);
    act(() => tree.unmount());
  });
});

describe('"Your usual" amounts and the account that follows the category', () => {
  async function history() {
    const on = (accountId: string, amountMinor: number, daysAgo: number) =>
      createTransaction({
        type: 'expense',
        accountId,
        categoryId: ids.food,
        amountMinor,
        date: addDaysToIsoDate(today, -daysAgo),
        note: '',
      });
    await on(ids.cash, 18_000, 9);
    await on(ids.cash, 18_000, 5);
    await on(ids.bank, 9_000, 2);
  }
  const accountChip = (tree: ReactTestRenderer) =>
    String(
      tree.root.find((n) => String(n.props.accessibilityLabel).startsWith('Account,') && n.props.onPress)
        .props.accessibilityLabel
    );
  const usualRow = (tree: ReactTestRenderer) =>
    tree.root
      .findAll(
        (n) =>
          /, logged \d+ times$/.test(String(n.props.accessibilityLabel)) &&
          typeof n.props.onPress === 'function'
      )
      .map((n) => String(n.props.accessibilityLabel));

  it('lists the entries you repeat, and one tap fills category, amount and account, saving exactly that', async () => {
    await history();
    const tree = await render();
    // Logged twice on Cash for ₹180; the single ₹90 on the Bank is not "usual".
    expect(usualRow(tree)).toEqual(['Food, ₹180, logged 2 times']);
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Food, ₹180, logged 2 times' && n.props.onPress)
        .props.onPress();
    });
    await save(tree);
    const row = (await saved()).find((r) => r.date === today)!;
    expect(row).toEqual(
      expect.objectContaining({
        amount_minor: 18_000,
        category_id: ids.food,
        account_id: ids.cash,
        type: 'expense',
      })
    );
    act(() => tree.unmount());
  });

  it('offers a category’s own amounts, most often first, once it is picked, and a tap fills the amount', async () => {
    await history();
    const tree = await render();
    await press(tree, 'Food');
    const amounts = tree.root
      .findAll(
        (n) =>
          n.props.accessibilityState &&
          'selected' in n.props.accessibilityState &&
          n.findAllByType(Text).some((t) => /^₹[\d,]+$/.test(textOf(t))) &&
          typeof n.props.onPress === 'function'
      )
      .flatMap((n) => n.findAllByType(Text).map(textOf))
      .filter((t) => /^₹[\d,]+$/.test(t));
    expect(amounts).toContain('₹180');
    act(() => tree.unmount());
  });

  it('moves to the account last used for that category, and says so on the account chip', async () => {
    await history();
    const tree = await render();
    await press(tree, 'Food');
    // The latest Food entry was on the Bank (₹90, two days ago).
    expect(accountChip(tree)).toContain('Bank');
    act(() => tree.unmount());
  });

  it('keeps the account you picked by hand when you then change the category', async () => {
    await history();
    const tree = await render();
    await act(async () => {
      tree.root
        .find((n) => String(n.props.accessibilityLabel).startsWith('Account,') && n.props.onPress)
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .find((n) => String(n.props.accessibilityLabel).startsWith('Cash') && n.props.onPress)
        .props.onPress();
      await settle();
    });
    await press(tree, 'Food');
    expect(accountChip(tree)).toContain('Cash');
    act(() => tree.unmount());
  });
});

describe('what the form says is missing', () => {
  const hint = (tree: ReactTestRenderer) =>
    texts(tree).filter((t) =>
      /^(Enter an amount|Enter a valid amount|Pick a category|Pick an account|Pick a person)$/.test(t.trim())
    );

  it('goes from "Enter an amount" to "Pick a category" as the form fills in, and says nothing once it can be saved', async () => {
    const tree = await render();
    expect(hint(tree)).toEqual(['Enter an amount']);
    await typeAmount(tree, '120');
    expect(hint(tree)).toEqual(['Pick a category']);
    await press(tree, 'Food');
    expect(hint(tree)).toEqual([]);
    act(() => tree.unmount());
  });

  it('explains an amount that rounds to nothing, and keeps "check the calculation" for a sum that is not positive', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '0.4');
    // It is not a calculation to check: it rounds to nothing in whole units, and says so, once.
    expect(texts(tree)).toContain(
      'Amounts are saved in whole units, so this comes to nothing. Enter at least 1.'
    );
    expect(texts(tree)).not.toContain('Enter a positive amount. Check the calculation.');
    act(() => tree.unmount());
    // A sum that does not come out positive is a calculation.
    const sum = await render();
    await press(sum, 'Food');
    await typeAmount(sum, '5−10');
    expect(texts(sum)).toContain('Enter a positive amount. Check the calculation.');
    act(() => sum.unmount());
  });

  it('does not say "Enter an amount" beside a Save that is ready: with entries on the list it says what Add more waits for', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '120');
    await press(tree, 'Add more');
    expect(texts(tree)).toContain('1 on your list');
    // The list can be saved as it is; only Add more is waiting on an amount.
    expect(hint(tree)).toEqual([]);
    expect(texts(tree)).toContain('Enter an amount to add another');
    const saveBtn = tree.root.find(
      (n) => isSaveTitle(n.props.title) && typeof n.props.onPress === 'function'
    );
    expect(saveBtn.props.title).toBe('Save 1 entry');
    expect(saveBtn.props.disabled).toBeFalsy();
    // Once something is typed it is about that entry again.
    await typeAmount(tree, '5');
    expect(texts(tree)).not.toContain('Enter an amount to add another');
    act(() => tree.unmount());
  });

  it('treats a zero typed on the way to a number as typed: it reads ₹0, says what is missing, and is not red', async () => {
    for (const typed of ['0', '0.', '0.0']) {
      const tree = await render();
      await press(tree, 'Food');
      await typeAmount(tree, typed);
      // Not the dash a failed sum shows, and not "check the calculation" for a number nobody calculated.
      expect(texts(tree)).toContain('₹0');
      expect(texts(tree)).not.toContain('₹—');
      expect(texts(tree)).not.toContain('Enter a positive amount. Check the calculation.');
      expect(texts(tree)).toContain('Enter an amount above zero');
      act(() => tree.unmount());
    }
    // A sum that falls to zero is still a calculation to check, with the dash.
    const sum = await render();
    await press(sum, 'Food');
    await typeAmount(sum, '5−5');
    expect(texts(sum)).toContain('₹—');
    expect(texts(sum)).toContain('Enter a positive amount. Check the calculation.');
    act(() => sum.unmount());
  });
});

describe('a very long note or label', () => {
  const long = 'x'.repeat(5000);
  it('is cut at the field, so a pasted message cannot make a screen-tall row in Activity', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '60');
    await act(async () => {
      tree.root.find((n) => n.props.accessibilityLabel === 'Add a label' && n.props.onPress).props.onPress();
    });
    const input = tree.root.find(
      (n) => n.props.accessibilityLabel === 'Expense label' && n.props.onChangeText
    );
    // The platform enforces maxLength on the text a person types or pastes.
    expect(input.props.maxLength).toBeGreaterThan(0);
    expect(input.props.maxLength).toBeLessThanOrEqual(200);
    act(() => tree.unmount());
    const income = await render();
    await press(income, 'Income');
    await act(async () => {
      income.root.find((n) => n.props.accessibilityLabel === 'Add a note' && n.props.onPress).props.onPress();
    });
    const note = income.root.find((n) => n.props.accessibilityLabel === 'Note' && n.props.onChangeText);
    expect(note.props.maxLength).toBeGreaterThan(0);
    expect(note.props.maxLength).toBeLessThanOrEqual(200);
    expect(long.length).toBeGreaterThan(note.props.maxLength);
    act(() => income.unmount());
  });
});
