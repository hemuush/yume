/**
 * Profile's "You" tab against a real database: accounts are created, edited, archived and deleted through the
 * real sheets, and what was stored (and what each balance comes to) is read back, so a mismatch between the form
 * and the data shows up here and not on a phone.
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

jest.setTimeout(60000);

let mockDb: ReturnType<typeof createRealDataTestDb>;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8', dot: '#F0876A' }),
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHide, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
  SheetLink: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
    require('react').createElement(require('react-native').Pressable, {
      onPress: disabled ? undefined : onPress,
      accessibilityLabel: label,
    }),
}));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
const mockAlert = jest.fn();
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), warn: jest.fn(), confirm: jest.fn() } }));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
  useLocalSearchParams: () => ({}),
}));

import { YouSection } from './YouSection';
import { AccountDetailModal } from './AccountDetailModal';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, listAccounts } from '@/db/ledger';
import { getAccountBalance } from '@/db/accounts';
import { createRecurringRule } from '@/db/recurring';
import { resetSettingsCache, setDefaultCurrency } from '@/db/settings';
import { toLocalIsoDate } from '@/lib/date';
import type { Account } from '@/types';

const today = toLocalIsoDate(new Date());
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const textOf = (n: ReactTestInstance) => [].concat(n.props.children).join('');
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map(textOf);

beforeEach(async () => {
  mockHide = false;
  mockAlert.mockClear();
  mockShowUndo.mockClear();
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  await setDefaultCurrency('INR');
});

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<YouSection />);
  });
  await act(settle);
  await act(settle);
  return tree;
}
async function press(tree: ReactTestRenderer, label: string) {
  await act(async () => {
    const hits = tree.root.findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        (n.props.accessibilityLabel === label || n.findAllByType(Text).some((t) => textOf(t) === label))
    );
    if (hits.length === 0) throw new Error(`No pressable "${label}"`);
    // The innermost one.
    const hit = hits.reduce((a, b) => (b.findAllByType(Text).length < a.findAllByType(Text).length ? b : a));
    await hit.props.onPress();
    await settle();
  });
}
const field = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.label === label && typeof n.props.onChangeText === 'function');
async function fill(tree: ReactTestRenderer, label: string, value: string) {
  await act(async () => field(tree, label).props.onChangeText(value));
}
const create_ = async (tree: ReactTestRenderer) => {
  await act(async () => {
    await tree.root.find((n) => n.props.title === 'Create account' && n.props.onPress).props.onPress();
    await settle();
  });
};
const accounts = () =>
  mockDb.getAllAsync<{
    id: string;
    name: string;
    type: string;
    currency: string;
    opening_balance_minor: number;
    credit_limit_minor: number | null;
    statement_day: number | null;
    due_day: number | null;
    archived: number;
  }>(
    'SELECT id, name, type, currency, opening_balance_minor, credit_limit_minor, statement_day, due_day, archived FROM accounts ORDER BY created_at, id'
  );

describe('adding an account', () => {
  it('stores a bank account as typed: trimmed name, opening balance in whole rupees, the app currency', async () => {
    const tree = await render();
    await press(tree, 'Add an account');
    await fill(tree, 'Name', '  HDFC Savings  ');
    await fill(tree, 'Opening balance', '5000');
    await create_(tree);
    expect(await accounts()).toEqual([
      expect.objectContaining({
        name: 'HDFC Savings',
        type: 'bank',
        currency: 'INR',
        opening_balance_minor: 500_000,
        archived: 0,
      }),
    ]);
    const [row] = await accounts();
    expect(await getAccountBalance(row.id)).toBe(500_000);
    // It is listed once the sheet closes.
    expect(texts(tree)).toContain('HDFC Savings');
    act(() => tree.unmount());
  });

  it('refuses an empty name, says so, and creates nothing', async () => {
    const tree = await render();
    await press(tree, 'Add an account');
    await fill(tree, 'Name', '   ');
    await create_(tree);
    expect(texts(tree)).toContain('Enter a name');
    expect(await accounts()).toEqual([]);
    act(() => tree.unmount());
  });

  it('rounds a typed opening balance to whole rupees, as every typed amount is', async () => {
    const tree = await render();
    await press(tree, 'Add an account');
    await fill(tree, 'Name', 'Wallet');
    await fill(tree, 'Opening balance', '1234.56');
    await create_(tree);
    expect((await accounts())[0].opening_balance_minor).toBe(123_500);
    act(() => tree.unmount());
  });

  it('stores a card with its limit and statement and due days', async () => {
    const tree = await render();
    await press(tree, 'Add an account');
    await fill(tree, 'Name', 'Axis card');
    await press(tree, 'Credit card');
    await fill(tree, 'Credit limit', '100000');
    await act(async () => {
      tree.root
        .find((n) => /statement/i.test(String(n.props.label)) && n.props.onChangeText)
        .props.onChangeText('5');
    });
    await act(async () => {
      tree.root
        .find(
          (n) =>
            /due/i.test(String(n.props.label)) && !/min/i.test(String(n.props.label)) && n.props.onChangeText
        )
        .props.onChangeText('25');
    });
    await create_(tree);
    expect(await accounts()).toEqual([
      expect.objectContaining({
        type: 'credit_card',
        credit_limit_minor: 10_000_000,
        statement_day: 5,
        due_day: 25,
      }),
    ]);
    act(() => tree.unmount());
  });

  it('rejects a statement day that is not a day of the month', async () => {
    const tree = await render();
    await press(tree, 'Add an account');
    await fill(tree, 'Name', 'Axis card');
    await press(tree, 'Credit card');
    await act(async () => {
      tree.root
        .find((n) => /statement/i.test(String(n.props.label)) && n.props.onChangeText)
        .props.onChangeText('45');
    });
    await act(async () => {
      tree.root
        .find(
          (n) =>
            /due/i.test(String(n.props.label)) && !/min/i.test(String(n.props.label)) && n.props.onChangeText
        )
        .props.onChangeText('25');
    });
    await create_(tree);
    expect(await accounts()).toEqual([]);
    expect(texts(tree).some((t) => /day/i.test(t) && /(1|31|valid|between)/i.test(t))).toBe(true);
    act(() => tree.unmount());
  });

  it('keeps the chosen currency on the account, whatever the app currency is', async () => {
    const tree = await render();
    await press(tree, 'Add an account');
    await fill(tree, 'Name', 'Travel card');
    await press(tree, 'USD');
    await create_(tree);
    expect((await accounts())[0].currency).toBe('USD');
    act(() => tree.unmount());
  });
});

// A card's balance is what is in it, so owing money is a negative opening balance. The pad has no minus key, so
// the card's field is "Owed on it now" and the sheet stores it negated.
describe('a credit card that already carries a bill', () => {
  it('labels a card’s opening field as what is owed, and every other account’s as the opening balance', async () => {
    const tree = await render();
    await press(tree, 'Add an account');
    expect(field(tree, 'Opening balance')).toBeTruthy();
    await press(tree, 'Credit card');
    expect(tree.root.findAll((n) => n.props.label === 'Opening balance')).toHaveLength(0);
    expect(field(tree, 'Owed on it now')).toBeTruthy();
    act(() => tree.unmount());
  });

  it('stores what is owed as money owing, so the balance, the limit used and the total all show a bill', async () => {
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1_000_000 });
    const tree = await render();
    await press(tree, 'Add');
    await fill(tree, 'Name', 'Axis card');
    await press(tree, 'Credit card');
    await fill(tree, 'Owed on it now', '20000');
    await fill(tree, 'Credit limit', '100000');
    await create_(tree);
    const card = (await accounts()).find((a) => a.name === 'Axis card')!;
    expect(card.opening_balance_minor).toBe(-2_000_000);
    expect(await getAccountBalance(card.id)).toBe(-2_000_000);
    const shown = texts(tree);
    // The ₹10,000 in the bank less the ₹20,000 owed: ₹10,000 short, not ₹30,000 in hand.
    expect(shown).toContain('-₹10,000');
    expect(shown).toContain('20% of limit used');
    act(() => tree.unmount());
  });

  it('keeps a card that owes nothing at exactly zero', async () => {
    const tree = await render();
    await press(tree, 'Add an account');
    await fill(tree, 'Name', 'New card');
    await press(tree, 'Credit card');
    await create_(tree);
    const [row] = await accounts();
    expect(row.opening_balance_minor).toBe(0);
    expect(Object.is(row.opening_balance_minor, -0)).toBe(false);
    act(() => tree.unmount());
  });
});

const seed = (over: Partial<Parameters<typeof createAccount>[0]> = {}) =>
  createAccount({ name: 'HDFC', type: 'bank', currency: 'INR', openingBalanceMinor: 1_000_000, ...over });
const fromDb = async (id: string): Promise<Account> =>
  (await listAccounts(true)).find((a) => a.id === id) as Account;

async function openDetail(id: string) {
  const onChanged = jest.fn();
  const onClose = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AccountDetailModal account={await fromDb(id)} onClose={onClose} onChanged={onChanged} />);
  });
  await act(settle);
  await act(settle);
  return { tree, onChanged, onClose };
}
const save = async (tree: ReactTestRenderer) => {
  await act(async () => {
    await tree.root.find((n) => n.props.title === 'Save changes' && n.props.onPress).props.onPress();
    await settle();
  });
};
const opening = async (id: string) => (await accounts()).find((a) => a.id === id)!.opening_balance_minor;

describe('editing an account', () => {
  it('keeps the exact opening balance, paise and all, when only the name is changed', async () => {
    const { id } = await seed({ openingBalanceMinor: 123_456 });
    const { tree } = await openDetail(id);
    await fill(tree, 'Name', 'HDFC Salary');
    await save(tree);
    const [row] = await accounts();
    expect(row.name).toBe('HDFC Salary');
    expect(row.opening_balance_minor).toBe(123_456);
    act(() => tree.unmount());
  });

  it('shows what a card owes as a plain amount, and saves a new one as owed', async () => {
    const { id } = await seed({ name: 'Axis', type: 'credit_card', openingBalanceMinor: -2_000_000 });
    const { tree } = await openDetail(id);
    expect(field(tree, 'Owed on it now').props.value).toBe('20000');
    await save(tree);
    expect(await opening(id)).toBe(-2_000_000);
    await fill(tree, 'Owed on it now', '5000');
    await save(tree);
    expect(await opening(id)).toBe(-500_000);
    act(() => tree.unmount());
  });

  it('shows a card that started with money in it as a minus, says so, and keeps it unless it is changed', async () => {
    const { id } = await seed({ name: 'Axis', type: 'credit_card', openingBalanceMinor: 2_000_000 });
    const { tree } = await openDetail(id);
    expect(field(tree, 'Owed on it now').props.value).toBe('-20000');
    expect(texts(tree)).toContain('A minus means the card started with money in it, not a bill.');
    await save(tree);
    expect(await opening(id)).toBe(2_000_000);
    act(() => tree.unmount());
  });

  it('reads “Opened owing” for a card with a bill, and “Opened with” for the rest', async () => {
    const card = await seed({ name: 'Axis', type: 'credit_card', openingBalanceMinor: -2_000_000 });
    const a = await openDetail(card.id);
    expect(texts(a.tree).some((t) => t.includes('Opened owing ₹20,000'))).toBe(true);
    act(() => a.tree.unmount());
    const bank = await seed({ name: 'Cash box', openingBalanceMinor: 300_000 });
    const b = await openDetail(bank.id);
    expect(texts(b.tree).some((t) => t.includes('Opened with ₹3,000'))).toBe(true);
    act(() => b.tree.unmount());
  });

  it('reads a bank account’s own number as what it is when it is switched to a card', async () => {
    const { id } = await seed({ openingBalanceMinor: 500_000 });
    const { tree } = await openDetail(id);
    expect(field(tree, 'Opening balance').props.value).toBe('5000');
    await press(tree, 'Credit card');
    // The label now says what the number means, so the 5000 on screen is what is owed.
    expect(field(tree, 'Owed on it now').props.value).toBe('5000');
    await save(tree);
    expect(await opening(id)).toBe(-500_000);
    act(() => tree.unmount());
  });
});

describe('archiving, unarchiving and deleting an account', () => {
  const bank = () => seed();
  let foodId: string | null = null;
  beforeEach(() => {
    foodId = null;
  });
  async function food() {
    foodId ??= (await createCategory({ name: 'Food', kind: 'expense' })).id;
    return foodId;
  }
  async function spend(accountId: string) {
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: await food(),
      amountMinor: 10_000,
      date: today,
      note: 'Lunch',
    });
  }
  async function rule(accountId: string, categoryId: string, note: string) {
    return createRecurringRule({
      type: 'expense',
      accountId,
      categoryId,
      amountMinor: 50_000,
      note,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: today,
    });
  }
  const activeRules = () =>
    mockDb.getAllAsync<{ note: string; active: number }>(
      'SELECT note, active FROM recurring_rules ORDER BY note'
    );
  const lastAlert = () =>
    mockAlert.mock.calls[mockAlert.mock.calls.length - 1] as [
      string,
      string,
      { text: string; onPress?: () => unknown }[]?,
    ];
  async function archiveFlow(tree: ReactTestRenderer, id: string) {
    await act(async () => {
      await tree.root
        .find(
          (n) =>
            typeof n.props.label === 'string' &&
            n.props.label.startsWith('Archive account') &&
            n.props.onPress
        )
        .props.onPress();
      await settle();
    });
    const [title, message, buttons] = lastAlert();
    expect(title).toBe('Archive this account?');
    return {
      message,
      confirm: async () =>
        act(async () => {
          await buttons!.find((b) => b.text === 'Archive')!.onPress!();
          await settle();
        }),
      id,
    };
  }

  it('says nothing about repeating entries when the account has none', async () => {
    const { id } = await bank();
    await spend(id);
    const { tree } = await openDetail(id);
    const { message } = await archiveFlow(tree, id);
    expect(message).not.toMatch(/repeating/);
    act(() => tree.unmount());
  });

  it('says its repeating entries will be paused, and stay paused, before archiving', async () => {
    const { id } = await bank();
    await spend(id);
    const cat = await food();
    await rule(id, cat, 'Gym');
    await rule(id, cat, 'Rent');
    const { tree } = await openDetail(id);
    const { message, confirm } = await archiveFlow(tree, id);
    expect(message).toContain(
      'Its 2 repeating entries are paused too, and stay paused until you resume them in Recurring.'
    );
    await confirm();
    expect((await accounts())[0].archived).toBe(1);
    expect(await activeRules()).toEqual([
      { note: 'Gym', active: 0 },
      { note: 'Rent', active: 0 },
    ]);
    act(() => tree.unmount());
  });

  it('uses the singular for one repeating entry, and only counts the ones that are running', async () => {
    const { id } = await bank();
    await spend(id);
    const cat = await food();
    await rule(id, cat, 'Gym');
    const paused = await rule(id, cat, 'Old plan');
    await mockDb.runAsync('UPDATE recurring_rules SET active = 0 WHERE id = ?', [paused.id]);
    const { tree } = await openDetail(id);
    const { message } = await archiveFlow(tree, id);
    expect(message).toContain(
      'Its 1 repeating entry is paused too, and stays paused until you resume it in Recurring.'
    );
    act(() => tree.unmount());
  });

  it('tells the person, when unarchiving, that the entries are still paused', async () => {
    const { id } = await bank();
    await spend(id);
    const cat = await food();
    await rule(id, cat, 'Gym');
    await rule(id, cat, 'Rent');
    const first = await openDetail(id);
    const { confirm } = await archiveFlow(first.tree, id);
    await confirm();
    act(() => first.tree.unmount());
    mockAlert.mockClear();
    const { tree, onChanged } = await openDetail(id);
    await act(async () => {
      await tree.root.find((n) => n.props.label === 'Unarchive account' && n.props.onPress).props.onPress();
      await settle();
    });
    expect((await accounts())[0].archived).toBe(0);
    expect(onChanged).toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      'Unarchived',
      'Its 2 repeating entries are still paused. Resume them in Recurring if you want them to post again.'
    );
    expect((await activeRules()).every((r) => r.active === 0)).toBe(true);
    act(() => tree.unmount());
  });

  it('unarchives quietly when there is nothing paused', async () => {
    const { id } = await bank();
    await spend(id);
    const first = await openDetail(id);
    const { confirm } = await archiveFlow(first.tree, id);
    await confirm();
    act(() => first.tree.unmount());
    mockAlert.mockClear();
    const { tree } = await openDetail(id);
    await act(async () => {
      await tree.root.find((n) => n.props.label === 'Unarchive account' && n.props.onPress).props.onPress();
      await settle();
    });
    expect((await accounts())[0].archived).toBe(0);
    expect(mockAlert).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('deletes an account with no history, and Undo brings it back with its balance', async () => {
    const { id } = await bank();
    const { tree, onChanged } = await openDetail(id);
    await act(async () => {
      await tree.root.find((n) => n.props.label === 'Delete account' && n.props.onPress).props.onPress();
      await settle();
    });
    const buttons = lastAlert()[2]!;
    await act(async () => {
      await buttons.find((b) => b.text === 'Delete')!.onPress!();
      await settle();
    });
    expect(await accounts()).toEqual([]);
    expect(onChanged).toHaveBeenCalled();
    expect(mockShowUndo).toHaveBeenCalledWith('Deleted "HDFC"', expect.any(Function));
    await act(async () => {
      await mockShowUndo.mock.calls[0][1]();
    });
    expect(await getAccountBalance(id)).toBe(1_000_000);
    act(() => tree.unmount());
  });

  it('explains why an account with only a repeating entry cannot be deleted, and keeps it', async () => {
    const { id } = await bank();
    await rule(id, await food(), 'Gym');
    const { tree } = await openDetail(id);
    await act(async () => {
      await tree.root.find((n) => n.props.label === 'Delete account' && n.props.onPress).props.onPress();
      await settle();
    });
    await act(async () => {
      await lastAlert()[2]!.find((b) => b.text === 'Delete')!.onPress!();
      await settle();
    });
    expect(await accounts()).toHaveLength(1);
    expect(lastAlert()[0]).toBe('Couldn’t delete');
    expect(lastAlert()[1]).toMatch(/repeating entries/);
    act(() => tree.unmount());
  });
});
