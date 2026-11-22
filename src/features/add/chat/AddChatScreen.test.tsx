/**
 * Add by chat, end to end on the screen: Suu asks one thing at a time, the answer is a tap (your usual entries, the
 * form's category grid, this category's usual amounts above the form's number pad, its account list, the calendar),
 * and Save goes through the form's own check and save (persistStaged) with exactly the entry the summary shows. The
 * pickers have their own tests: here they are stood in by plain buttons.
 */
import { Text, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn() } }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardStickyView: require('react-native').View }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
jest.mock('@/features/home/SkyHeader', () => ({ SkyHeader: () => null }));
jest.mock('@/hooks/useCollapsingHeader', () => ({
  useCollapsingHeader: () => ({
    collapse: {},
    headerHeight: 0,
    scrollHandler: undefined,
    scrollRef: { current: null },
  }),
}));
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn() }));
jest.mock('@/lib/justAdded', () => ({ markJustAdded: jest.fn() }));
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  ...jest.requireActual('@/theme/PrivacyContext'),
  usePrivacy: () => ({ hideAmounts: mockHideAmounts }),
}));
jest.mock('@/components/CategoryIcon', () => ({ CategoryIcon: () => null }));
// The form's own pickers, as plain buttons.
jest.mock('@/components/CategoryPicker', () => ({
  CategoryPicker: ({
    categories,
    selectedId,
    onSelect,
  }: {
    categories: { id: string; name: string }[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  }) => {
    const { Pressable: P, Text: T } = require('react-native');
    return categories.map((c) => (
      <P
        key={c.id}
        accessibilityLabel={c.name}
        accessibilityState={{ selected: c.id === selectedId }}
        onPress={() => onSelect(c.id)}
      >
        <T>{c.name}</T>
      </P>
    ));
  },
}));
jest.mock('@/features/add/components/AccountPickList', () => ({
  AccountPickList: ({
    accounts,
    onPick,
  }: {
    accounts: { id: string; name: string }[];
    onPick: (id: string) => void;
  }) => {
    const { Pressable: P, Text: T } = require('react-native');
    return accounts.map((a) => (
      <P key={a.id} accessibilityLabel={a.name} onPress={() => onPick(a.id)}>
        <T>{a.name}</T>
      </P>
    ));
  },
}));
jest.mock('@/components/Chip', () => ({
  Chip: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const { Pressable: P, Text: T } = require('react-native');
    return (
      <P accessibilityLabel={label} onPress={onPress}>
        <T>{label}</T>
      </P>
    );
  },
}));
let mockCalendarPick = '2026-10-05';
jest.mock('@/components/CalendarSheet', () => ({
  CalendarSheet: ({ visible, onPick }: { visible: boolean; onPick: (iso: string) => void }) => {
    const { Pressable: P } = require('react-native');
    return visible ? (
      <P accessibilityLabel="calendar: pick" onPress={() => onPick(mockCalendarPick)} />
    ) : null;
  },
}));
// The form's number pad: its keys as buttons, with the Done row it is given.
jest.mock('@/components/AmountPad', () => ({
  AmountPad: ({
    onKey,
    onClear,
    children,
  }: {
    onKey: (k: string) => void;
    onClear: () => void;
    children: React.ReactNode;
  }) => {
    const { Pressable: P, View: V } = require('react-native');
    return (
      <V>
        {'0123456789.+'.split('').map((k) => (
          <P key={k} accessibilityLabel={`key ${k}`} onPress={() => onKey(k)} />
        ))}
        <P accessibilityLabel="key clear" onPress={onClear} />
        {children}
      </V>
    );
  },
}));
let mockCreated: { onCreated: () => void } | null = null;
jest.mock('@/features/people/AddPersonModal', () => ({
  AddPersonModal: (props: { visible: boolean; onCreated: () => void }) => {
    if (props.visible) mockCreated = props;
    return null;
  },
}));
jest.mock('@/features/profile/AddAccountModal', () => ({ AddAccountModal: () => null }));

const mockAccounts = [
  { id: 'sbi', name: 'SBI', type: 'bank', currency: 'INR', archived: false },
  { id: 'cash', name: 'Cash', type: 'cash', currency: 'INR', archived: false },
  { id: 'fd', name: 'Emergency fund', type: 'savings', currency: 'INR', archived: false },
];
const category = (
  id: string,
  name: string,
  kind: string,
  sortOrder: number,
  parentId: string | null = null
) => ({
  id,
  name,
  kind,
  parentId,
  icon: 'tag',
  color: '#000',
  archived: false,
  sortOrder,
  isSystem: false,
});
const mockCategories = [
  category('food', 'Food & Dining', 'expense', 1),
  category('rent', 'Rent', 'expense', 2),
  category('groc', 'Groceries', 'expense', 3),
  category('blink', 'Blinkit', 'expense', 1, 'groc'),
  category('salary', 'Salary', 'income', 1),
];
let mockUsual: unknown[] = [];
let mockFrequent: number[] = [];
let mockLastAccount: string | null = null;
jest.mock('@/db/ledger', () => ({
  listAccounts: jest.fn(async () => mockAccounts),
  listCategories: jest.fn(async () => mockCategories),
  findRecentRepeat: jest.fn(async () => null),
  getRepeatEntries: jest.fn(async () => mockUsual),
  getFrequentAmountsForCategory: jest.fn(async () => mockFrequent),
  getLastAccountForCategory: jest.fn(async () => mockLastAccount),
}));
let mockPeople: unknown[] = [{ id: 'ravi', name: 'Ravi' }];
jest.mock('@/db/people', () => ({ listPeople: jest.fn(async () => mockPeople) }));
let mockDefaults: unknown = {};
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getAddDefaults: jest.fn(async () => mockDefaults),
  setAddDefaults: jest.fn(async () => {}),
}));
jest.mock('@/features/add/saveEntry', () => ({ persistStaged: jest.fn(async () => 'new-id') }));
jest.mock('@/db/splits', () => ({
  saveSplit: jest.fn(async () => 'split-1'),
  getSplitParts: jest.fn(async () => [{ id: 'part-a' }, { id: 'part-b' }]),
}));

import { persistStaged } from '@/features/add/saveEntry';
import { saveSplit } from '@/db/splits';
import { showAlert } from '@/components/AppDialog';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { findRecentRepeat } from '@/db/ledger';
import { setAddDefaults } from '@/db/settings';
import { router } from 'expo-router';
import { AddChatScreen } from './AddChatScreen';

async function open(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AddChatScreen />);
  });
  await act(async () => {});
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
/** A control by its spoken label, or by its title (PrimaryButton). */
const control = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) =>
      (n.props.accessibilityLabel === label || n.props.title === label) &&
      typeof n.props.onPress === 'function'
  )[0];
const press = async (tree: ReactTestRenderer, label: string) => {
  const target = control(tree, label);
  if (!target) throw new Error(`no control "${label}"; on screen: ${texts(tree).slice(-8).join(' | ')}`);
  await act(async () => target.props.onPress());
};
/** Taps an amount out on the number pad, then Done. */
async function pad(tree: ReactTestRenderer, keys: string) {
  for (const k of keys) await press(tree, `key ${k}`);
  await press(tree, 'Done');
}
const saved = () => jest.mocked(persistStaged).mock.calls[0][0] as unknown as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockPeople = [{ id: 'ravi', name: 'Ravi' }];
  mockDefaults = {};
  mockUsual = [];
  mockFrequent = [];
  mockLastAccount = null;
  mockCreated = null;
  mockHideAmounts = false;
  mockCalendarPick = '2026-10-05';
});

it('opens by asking what to add, with the form’s four types as cards and nothing to type', async () => {
  const tree = await open();
  expect(texts(tree)).toContain('What would you like to add?');
  for (const t of ['Expense', 'Income', 'Transfer', 'Friend']) expect(control(tree, `Add ${t}`)).toBeTruthy();
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
});

it('walks an expense with taps only: category, amount on the pad, account, day, note', async () => {
  const tree = await open();
  await press(tree, 'Add Expense');
  expect(texts(tree)).toContain('Which category?');
  expect(control(tree, 'Food & Dining')).toBeTruthy(); // the categories are shown to pick from
  expect(control(tree, 'Salary')).toBeUndefined(); // income ones are not

  await press(tree, 'Food & Dining');
  expect(texts(tree)).toContain('How much?');
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0); // the number pad, not the keyboard
  expect(control(tree, 'Done')?.props.disabled).toBe(true);
  await pad(tree, '850');

  expect(texts(tree)).toContain('Which account did you pay from?');
  await press(tree, 'SBI');
  expect(texts(tree)).toContain('When was it?');
  await press(tree, 'Yesterday');
  expect(texts(tree)).toContain('Add a note? You can skip this.');
  await press(tree, 'No note');

  // The summary: every field of the form, and Save.
  expect(texts(tree)).toEqual(
    expect.arrayContaining([
      'Amount',
      '−₹850',
      'Category',
      'Food & Dining',
      'Pay from',
      'SBI',
      'Date',
      'Yesterday',
    ])
  );
  await press(tree, 'Save');
  expect(saved()).toMatchObject({
    kind: 'transaction',
    type: 'expense',
    amountMinor: 85000,
    categoryId: 'food',
    accountId: 'sbi',
    note: '',
  });
  expect(texts(tree).some((t) => t.startsWith('Saved ✓'))).toBe(true);
  expect(setAddDefaults).toHaveBeenCalledWith({ expense: { accountId: 'sbi', categoryId: 'food' } });
  expect(control(tree, 'Add Expense')).toBeTruthy(); // ready for the next one
});

it('does sums on the pad, as the form does', async () => {
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await press(tree, 'key 1');
  await press(tree, 'key 2');
  await press(tree, 'key 0');
  await press(tree, 'key +');
  await press(tree, 'key 4');
  await press(tree, 'key 5');
  expect(texts(tree)).toContain('₹165'); // the total shows as it is typed
  await press(tree, 'Done');
  await press(tree, 'SBI');
  await press(tree, 'Today');
  await press(tree, 'No note');
  await press(tree, 'Save');
  expect(saved()).toMatchObject({ amountMinor: 16500 });
});

it('offers this category’s usual amounts above the pad: one tap is the amount', async () => {
  mockFrequent = [15000, 30000];
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  expect(control(tree, '₹150')).toBeTruthy();
  await press(tree, '₹300');
  expect(texts(tree)).toContain('Which account did you pay from?');
  await press(tree, 'SBI');
  await press(tree, 'Today');
  await press(tree, 'No note');
  await press(tree, 'Save');
  expect(saved()).toMatchObject({ amountMinor: 30000 });
});

it('offers your usual entries first: one tap fills the category, amount and account', async () => {
  mockUsual = [
    {
      type: 'expense',
      accountId: 'cash',
      accountCurrency: 'INR',
      categoryId: 'food',
      categoryName: 'Food & Dining',
      parentName: null,
      categoryIcon: 'tag',
      categoryColor: '#000',
      amountMinor: 34000,
      note: 'lunch',
      timesLogged: 5,
    },
  ];
  const tree = await open();
  await press(tree, 'Add Expense');
  expect(texts(tree)).toContain('One of your usual, or something else?');
  await press(tree, 'Food & Dining, ₹340');
  // Straight to the summary, with all of it filled in.
  expect(texts(tree)).toContain('Here it is. Tap anything to change it, then save.');
  expect(texts(tree)).toEqual(expect.arrayContaining(['−₹340', 'Food & Dining', 'Cash', 'lunch']));
  await press(tree, 'Save');
  expect(saved()).toMatchObject({
    categoryId: 'food',
    amountMinor: 34000,
    accountId: 'cash',
    note: 'lunch',
  });
});

it('lets you choose something else instead of a usual entry', async () => {
  mockUsual = [
    {
      type: 'expense',
      accountId: 'cash',
      accountCurrency: 'INR',
      categoryId: 'food',
      categoryName: 'Food & Dining',
      parentName: null,
      categoryIcon: 'tag',
      categoryColor: '#000',
      amountMinor: 34000,
      note: '',
      timesLogged: 3,
    },
  ];
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Something else');
  expect(texts(tree)).toContain('Which category?');
});

it('goes straight to the day when the category already has an account it is usually paid from', async () => {
  mockLastAccount = 'cash';
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '40');
  // The account that category was last used with came along: it is not asked.
  expect(texts(tree)).toContain('When was it?');
  await press(tree, 'Today');
  await press(tree, 'No note');
  expect(texts(tree)).toEqual(expect.arrayContaining(['Pay from', 'Cash']));
  await press(tree, 'Save');
  expect(saved()).toMatchObject({ accountId: 'cash' });
});

it('does not let a category pick a savings account, and asks instead', async () => {
  mockLastAccount = 'fd'; // a savings account
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '40');
  expect(texts(tree)).toContain('Which account did you pay from?');
});

it('starts from the account and category last used, as the form does: shown, not asked again', async () => {
  mockDefaults = { expense: { accountId: 'cash', categoryId: 'rent' } };
  const tree = await open();
  await press(tree, 'Add Expense');
  // The category is still shown to choose, with the last one highlighted; the account is not asked.
  expect(control(tree, 'Rent')?.props.accessibilityState).toEqual({ selected: true });
  await press(tree, 'Rent');
  await pad(tree, '12000');
  expect(texts(tree)).toContain('When was it?');
  await press(tree, 'Today');
  await press(tree, 'No note');
  await press(tree, 'Save');
  expect(saved()).toMatchObject({ accountId: 'cash', categoryId: 'rent', amountMinor: 1200000 });
});

it('shows subcategories before using a parent: tap one, or use the parent as it is', async () => {
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Groceries'); // has a subcategory: not taken yet
  expect(texts(tree)).toContain('Which category?');
  expect(control(tree, 'Use Groceries')).toBeTruthy();
  await press(tree, 'Blinkit');
  expect(texts(tree)).toContain('How much?'); // the subcategory was taken

  await press(tree, 'Start over');
  await press(tree, 'Add Expense');
  await press(tree, 'Groceries');
  await press(tree, 'Use Groceries');
  expect(texts(tree)).toContain('How much?');
});

it('changes any field from the summary by tapping its row, then comes straight back', async () => {
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '850');
  await press(tree, 'SBI');
  await press(tree, 'Today');
  await press(tree, 'No note');

  await press(tree, 'Pay from: SBI. Change');
  await press(tree, 'Cash');
  expect(texts(tree)).toContain('Here it is. Tap anything to change it, then save.');

  await press(tree, 'Amount: −₹850. Change');
  expect(texts(tree)).toContain('How much?');
  await press(tree, 'key clear');
  await pad(tree, '900');
  await press(tree, 'Save');
  expect(saved()).toMatchObject({ accountId: 'cash', amountMinor: 90000 });
});

it('changes the type from the summary like the form tabs, and asks what the new type needs', async () => {
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '5000');
  await press(tree, 'SBI');
  await press(tree, 'Today');
  await press(tree, 'No note');

  await press(tree, 'Transfer');
  expect(texts(tree)).toContain('Move it to which account?');
  expect(control(tree, 'SBI')).toBeUndefined(); // the account it leaves is not offered as the destination
  await press(tree, 'Cash');
  // The amount, day and note were answered already: straight to the summary.
  expect(texts(tree)).toContain('Here it is. Tap anything to change it, then save.');
  await press(tree, 'Save');
  expect(saved()).toMatchObject({
    type: 'transfer',
    accountId: 'sbi',
    toAccountId: 'cash',
    amountMinor: 500000,
  });
});

it('marks an expense as money back, like the form’s toggle', async () => {
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '200');
  await press(tree, 'SBI');
  await press(tree, 'Today');
  await press(tree, 'No note');
  await press(tree, 'Money back');
  expect(texts(tree)).toContain('On');
  await press(tree, 'Save');
  // A refund is money in, back to the expense category it came from.
  expect(saved()).toMatchObject({ type: 'income', isRefund: true, categoryId: 'food', amountMinor: 20000 });
});

it('walks a transfer: from, to, then how much', async () => {
  const tree = await open();
  await press(tree, 'Add Transfer');
  expect(texts(tree)).toContain('Move it from which account?');
  await press(tree, 'SBI');
  expect(texts(tree)).toContain('Move it to which account?');
  await press(tree, 'Cash');
  expect(texts(tree)).toContain('How much?');
  await pad(tree, '2000');
  await press(tree, 'Today');
  await press(tree, 'No note');
  await press(tree, 'Save');
  expect(saved()).toMatchObject({
    type: 'transfer',
    accountId: 'sbi',
    toAccountId: 'cash',
    amountMinor: 200000,
  });
});

it('walks a friend entry: person, which way, how much, account or none', async () => {
  const tree = await open();
  await press(tree, 'Add Friend');
  expect(texts(tree)).toContain('Who is it with?');
  await press(tree, 'Ravi');
  expect(texts(tree)).toContain('Which way did the money go?');
  await press(tree, 'I got');
  await pad(tree, '500');
  await press(tree, 'Today');
  await press(tree, 'No note');
  expect(texts(tree)).toContain('Not tied to an account');
  await press(tree, 'Save');
  expect(saved()).toMatchObject({
    kind: 'friend',
    personId: 'ravi',
    sign: -1,
    accountId: null,
    amountMinor: 50000,
  });
});

it('adds a person on the spot when there is no one under People yet', async () => {
  mockPeople = [];
  const tree = await open();
  await press(tree, 'Add Friend');
  expect(control(tree, 'Add a person')).toBeTruthy();
  expect(texts(tree)).toContain('Add your first person');
  await press(tree, 'Add a person');
  mockPeople = [{ id: 'asha', name: 'Asha' }];
  await act(async () => mockCreated?.onCreated());
  await act(async () => {});
  expect(control(tree, 'Asha')).toBeTruthy();
});

it('takes a date from the calendar', async () => {
  const tree = await open();
  await press(tree, 'Add Income');
  expect(control(tree, 'Salary')).toBeTruthy();
  expect(control(tree, 'Rent')).toBeUndefined();
  await press(tree, 'Salary');
  await pad(tree, '50000');
  await press(tree, 'SBI');
  await press(tree, 'Pick a date');
  await press(tree, 'calendar: pick');
  await press(tree, 'No note');
  expect(texts(tree)).toContain('+₹50,000');
  await press(tree, 'Save');
  expect(String(saved().date)).toMatch(/-10-05$/);
});

it('types a note only if you ask to', async () => {
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '300');
  await press(tree, 'SBI');
  await press(tree, 'Today');
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await press(tree, 'Add a note');
  const input = tree.root.findByType(TextInput);
  await act(async () => input.props.onChangeText('team lunch'));
  await act(async () => input.props.onSubmitEditing());
  expect(texts(tree)).toContain('team lunch');
  await press(tree, 'Save');
  expect(saved()).toMatchObject({ note: 'team lunch' });
});

it('warns once about an entry just like one saved a moment ago, then goes ahead', async () => {
  jest.mocked(findRecentRepeat).mockResolvedValueOnce({ savedAt: new Date().toISOString() });
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '850');
  await press(tree, 'SBI');
  await press(tree, 'Today');
  await press(tree, 'No note');
  await press(tree, 'Save');
  expect(persistStaged).not.toHaveBeenCalled();
  expect(texts(tree).some((t) => t.includes('a moment ago'))).toBe(true);
  await press(tree, 'Save');
  expect(persistStaged).toHaveBeenCalledTimes(1);
});

it('opens the form with the entry filled in, and can be started over at any step', async () => {
  const tree = await open();
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '850');
  await press(tree, 'SBI');
  await press(tree, 'Edit in the form');
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/add-transaction',
    params: expect.objectContaining({
      type: 'expense',
      amount: '85000',
      accountId: 'sbi',
      categoryId: 'food',
    }),
  });
  expect(control(tree, 'Add Expense')).toBeTruthy();

  await press(tree, 'Add Expense');
  await press(tree, 'Start over');
  expect(control(tree, 'Add Income')).toBeTruthy();
  expect(control(tree, 'Food & Dining')).toBeUndefined();
});

/** An expense of 1,000 on SBI, ready on the summary. */
async function summaryOf1000(tree: ReactTestRenderer) {
  await press(tree, 'Add Expense');
  await press(tree, 'Food & Dining');
  await pad(tree, '1000');
  await press(tree, 'SBI');
  await press(tree, 'Today');
  await press(tree, 'No note');
}

describe('splitting between categories', () => {
  it('adds parts with a category and an amount each, the first keeping the rest, and saves them as one split', async () => {
    const tree = await open();
    await summaryOf1000(tree);
    await press(tree, 'Split between categories');
    expect(texts(tree)).toContain('Which category is the next part for?');
    await press(tree, 'Rent');
    expect(texts(tree)).toContain('How much for Rent?');
    await pad(tree, '300');
    expect(texts(tree).some((t) => t.includes('Food & Dining keeps ₹700'))).toBe(true);

    await press(tree, 'Add another part');
    await press(tree, 'Groceries');
    await press(tree, 'Use Groceries');
    await pad(tree, '200');
    await press(tree, 'Done splitting');

    // The summary lists the parts: the first holds what the others leave.
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Split into 3 parts',
        'Food & Dining',
        '₹500',
        'Rent',
        '₹300',
        'Groceries',
        '₹200',
      ])
    );
    await press(tree, 'Save');
    expect(saveSplit).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'sbi',
        parts: [
          { categoryId: 'food', amountMinor: 50000 },
          { categoryId: 'rent', amountMinor: 30000 },
          { categoryId: 'groc', amountMinor: 20000 },
        ],
      })
    );
    expect(persistStaged).not.toHaveBeenCalled(); // a split is saved as one, not as a plain entry
    expect(texts(tree).some((t) => t.startsWith('Saved ✓'))).toBe(true);
  });

  it('refuses a part that leaves nothing for the first one, and asks again', async () => {
    const tree = await open();
    await summaryOf1000(tree);
    await press(tree, 'Split between categories');
    await press(tree, 'Rent');
    await pad(tree, '1000');
    expect(texts(tree).some((t) => t.includes('Leave some for Food & Dining'))).toBe(true);
    expect(texts(tree)).toContain('How much for Rent?');
    await press(tree, 'key clear');
    await pad(tree, '400');
    expect(texts(tree).some((t) => t.includes('keeps ₹600'))).toBe(true);
  });

  it('can be taken off again, and is not offered for money back', async () => {
    const tree = await open();
    await summaryOf1000(tree);
    await press(tree, 'Split between categories');
    await press(tree, 'Rent');
    await pad(tree, '300');
    await press(tree, 'Done splitting');
    await press(tree, 'Remove the split');
    expect(control(tree, 'Split between categories')).toBeTruthy();
    await press(tree, 'Money back');
    expect(control(tree, 'Split between categories')).toBeUndefined();
  });

  it('follows a change of the first part’s category, and is dropped when the type changes', async () => {
    const tree = await open();
    await summaryOf1000(tree);
    await press(tree, 'Split between categories');
    await press(tree, 'Rent');
    await pad(tree, '300');
    await press(tree, 'Done splitting');
    await press(tree, 'Category: Food & Dining. Change');
    await press(tree, 'Groceries');
    await press(tree, 'Use Groceries');
    expect(texts(tree)).toEqual(expect.arrayContaining(['Split into 2 parts', 'Groceries', '₹700']));
    await press(tree, 'Income');
    expect(texts(tree).some((t) => t.startsWith('Split into'))).toBe(false);
  });
});

const usualEntry = (over: Record<string, unknown> = {}) => ({
  type: 'expense',
  accountId: 'sbi',
  accountCurrency: 'INR',
  categoryId: 'food',
  categoryName: 'Food & Dining',
  parentName: null,
  categoryIcon: 'tag',
  categoryColor: '#000',
  amountMinor: 500000,
  note: '',
  timesLogged: 4,
  ...over,
});

describe('privacy: "Hide savings & investment amounts"', () => {
  it('hides the amount of a sensitive usual entry on its card and in the conversation, as the form does', async () => {
    mockHideAmounts = true;
    mockUsual = [usualEntry({ categoryName: 'Investments', isSensitive: true })];
    const tree = await open();
    await press(tree, 'Add Expense');
    expect(texts(tree).some((t) => t.includes('5,000'))).toBe(false);
    expect(texts(tree)).toContain('₹••••');
    expect(control(tree, 'Investments, ₹••••')).toBeTruthy();
    await press(tree, 'Investments, ₹••••');
    // The line that goes into the conversation is masked too.
    expect(texts(tree)).toContain('Investments · ₹••••');
  });
  it('leaves an ordinary usual entry alone, and shows a sensitive one when the setting is off', async () => {
    mockHideAmounts = true;
    mockUsual = [usualEntry()];
    let tree = await open();
    await press(tree, 'Add Expense');
    expect(control(tree, 'Food & Dining, ₹5,000')).toBeTruthy();

    mockHideAmounts = false;
    mockUsual = [usualEntry({ isSensitive: true })];
    tree = await open();
    await press(tree, 'Add Expense');
    expect(control(tree, 'Food & Dining, ₹5,000')).toBeTruthy();
  });
});

it('does not start an entry twice when a type card is tapped twice quickly', async () => {
  mockUsual = [usualEntry()];
  const tree = await open();
  const card = control(tree, 'Add Expense');
  await act(async () => {
    card.props.onPress();
    card.props.onPress();
  });
  expect(texts(tree).filter((t) => t === 'Expense')).toHaveLength(1);
});

describe('amounts keep their paise, as in the form', () => {
  it('saves 850.50 as typed', async () => {
    const tree = await open();
    await press(tree, 'Add Expense');
    await press(tree, 'Food & Dining');
    for (const k of '850.5') await press(tree, `key ${k}`);
    expect(texts(tree)).toContain('₹850.50'); // what the pad shows is what is saved
    await press(tree, 'Done');
    await press(tree, 'SBI');
    await press(tree, 'Today');
    await press(tree, 'No note');
    await press(tree, 'Save');
    expect(saved()).toMatchObject({ amountMinor: 85050 });
  });
  it('does not take an amount too small to keep', async () => {
    const tree = await open();
    await press(tree, 'Add Expense');
    await press(tree, 'Food & Dining');
    for (const k of '0.004') await press(tree, `key ${k}`);
    expect(control(tree, 'Done')?.props.disabled).toBe(true);
  });
  it('keeps the parts of a split to the paisa too', async () => {
    const tree = await open();
    await summaryOf1000(tree);
    await press(tree, 'Split between categories');
    await press(tree, 'Rent');
    for (const k of '300.4') await press(tree, `key ${k}`);
    await press(tree, 'Done');
    expect(texts(tree).some((t) => t.includes('keeps ₹699.60'))).toBe(true);
    await press(tree, 'Done splitting');
    await press(tree, 'Save');
    expect(saveSplit).toHaveBeenCalledWith(
      expect.objectContaining({
        parts: [
          { categoryId: 'food', amountMinor: 69960 },
          { categoryId: 'rent', amountMinor: 30040 },
        ],
      })
    );
  });
});

describe('a date far ahead is confirmed, as in the form', () => {
  const today = toLocalIsoDate(new Date());
  async function toSummaryOn(tree: ReactTestRenderer, date: string) {
    mockCalendarPick = date;
    await press(tree, 'Add Expense');
    await press(tree, 'Food & Dining');
    await pad(tree, '300');
    await press(tree, 'SBI');
    await press(tree, 'Pick a date');
    await press(tree, 'calendar: pick');
    await press(tree, 'No note');
  }
  const alertButtons = () =>
    jest.mocked(showAlert).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];

  it('asks before saving a date more than a week ahead, naming how far, and saves only when told to', async () => {
    const tree = await open();
    await toSummaryOn(tree, addDaysToIsoDate(today, 30));
    await press(tree, 'Save');
    expect(persistStaged).not.toHaveBeenCalled();
    const [title, message] = jest.mocked(showAlert).mock.calls.at(-1) as [string, string];
    expect(title).toMatch(/^Save it for /);
    expect(message).toBe('That’s 30 days from today.');
    await act(async () =>
      alertButtons()
        .find((b) => b.text === 'Save')
        ?.onPress?.()
    );
    expect(persistStaged).toHaveBeenCalledTimes(1);
  });

  it('lets the person change the date instead', async () => {
    const tree = await open();
    await toSummaryOn(tree, addDaysToIsoDate(today, 400));
    await press(tree, 'Save');
    await act(async () =>
      alertButtons()
        .find((b) => b.text === 'Change date')
        ?.onPress?.()
    );
    expect(texts(tree)).toContain('When was it?');
    expect(persistStaged).not.toHaveBeenCalled();
  });

  it('does not ask about today, the past, or up to a week ahead', async () => {
    for (const date of [today, addDaysToIsoDate(today, -40), addDaysToIsoDate(today, 7)]) {
      jest.clearAllMocks();
      const tree = await open();
      await toSummaryOn(tree, date);
      await press(tree, 'Save');
      expect(showAlert).not.toHaveBeenCalled();
      expect(persistStaged).toHaveBeenCalledTimes(1);
    }
  });

  it('asks for a split too', async () => {
    const tree = await open();
    await toSummaryOn(tree, addDaysToIsoDate(today, 60));
    await press(tree, 'Split between categories');
    await press(tree, 'Rent');
    await pad(tree, '100');
    await press(tree, 'Done splitting');
    await press(tree, 'Save');
    expect(saveSplit).not.toHaveBeenCalled();
    await act(async () =>
      alertButtons()
        .find((b) => b.text === 'Save')
        ?.onPress?.()
    );
    expect(saveSplit).toHaveBeenCalledTimes(1);
  });
});
