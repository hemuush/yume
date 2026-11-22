/** Hard cases for Add: random pad keystrokes, exact paise, rapid-tap save and splits that always add up. */
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
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
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
// Keeps the add-category form's props, so a test can finish it the way the real form does.
const mockCategoryForm: {
  current: { visible: boolean; initialKind: string; onSaved: (c?: unknown) => void } | null;
} = { current: null };
jest.mock('@/features/categories/AddCategoryModal', () => ({
  AddCategoryModal: (props: { visible: boolean; initialKind: string; onSaved: (c?: unknown) => void }) => {
    mockCategoryForm.current = props;
    return null;
  },
}));
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

import { applyPadKey, evaluateAmount, type PadKey } from '@/lib/padMath';
import { toMinor } from '@/lib/money';
import { partAmounts, splitProblem, toSplitParts, type DraftPart } from './splitDraft';
import AddTransactionScreen from '../../../app/add-transaction';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { createPerson } from '@/db/people';
import { resetSettingsCache, setDefaultCurrency } from '@/db/settings';

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
  await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1_000_000 });
  await createAccount({ name: 'Cash', type: 'cash', currency: 'INR', openingBalanceMinor: 100_000 });
  await createAccount({ name: 'Pot', type: 'savings', currency: 'INR', openingBalanceMinor: 500_000 });
  await createCategory({ name: 'Food', kind: 'expense' });
  await createCategory({ name: 'Salary', kind: 'income' });
  await createPerson({ name: 'Aarav' });
  // The built-in categories Friends & Family entries are filed under (a fresh install has them seeded).
  await createCategory({ name: 'Friends & Family', kind: 'expense' });
  await createCategory({ name: 'Friends & Family', kind: 'income' });
  await mockDb.runAsync("UPDATE categories SET is_system = 1 WHERE name = 'Friends & Family'");
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

const KEYS: PadKey[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+', '−', '×', '÷', 'back'];
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pressBack = (tree: ReactTestRenderer) =>
  act(async () => {
    tree.root.find((n) => n.props.accessibilityLabel === 'delete' && n.props.onPress).props.onPress();
  });

describe('Add hard cases', () => {
  it('survives random keystrokes (including long-press clear) and saves exactly what the pad computes, or nothing', async () => {
    for (let round = 0; round < 6; round++) {
      await mockDb.runAsync('DELETE FROM transactions');
      const tree = await render();
      await press(tree, 'Food');
      let expr = '';
      for (let i = 0; i < 40; i++) {
        const k = KEYS[Math.floor(rnd() * KEYS.length)];
        if (rnd() < 0.03) {
          await act(async () => {
            tree.root
              .find((n) => n.props.accessibilityLabel === 'delete' && n.props.onLongPress)
              .props.onLongPress();
          });
          expr = '';
          continue;
        }
        expr = applyPadKey(expr, k);
        if (k === 'back') await pressBack(tree);
        else await typeAmount(tree, k);
      }
      await save(tree);
      const rows = await saved();
      const value = evaluateAmount(expr);
      if (value === null) expect(rows).toEqual([]);
      else expect(rows.map((r) => r.amount_minor)).toEqual([toMinor(value)]);
      act(() => tree.unmount());
    }
  });

  it.each([
    ['0.01', 1],
    ['44.44', 4444],
    ['999999999.99', 99_999_999_999],
    ['0.1+0.2', 30],
    ['1.15×100', 11_500],
  ])('saves %s as exactly %s minor units', async (typed, minor) => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, typed);
    await save(tree);
    expect((await saved()).map((r) => r.amount_minor)).toEqual([minor]);
    act(() => tree.unmount());
  });

  it('adds a category from the grid, picks it and saves the entry under it', async () => {
    const tree = await render();
    await typeAmount(tree, '75');
    await press(tree, 'New');
    expect(mockCategoryForm.current).toMatchObject({ visible: true, initialKind: 'expense' });
    const created = await createCategory({ name: 'Pets', kind: 'expense' });
    await act(async () => {
      mockCategoryForm.current!.onSaved(created);
      await settle();
    });
    expect(mockCategoryForm.current?.visible).toBe(false);
    await save(tree);
    const rows = await saved();
    expect(rows.map((r) => [r.amount_minor, r.category_id])).toEqual([[7500, created.id]]);
    act(() => tree.unmount());
  });

  it('does not pick a new category of the other kind', async () => {
    const tree = await render();
    await typeAmount(tree, '75');
    await press(tree, 'Food');
    await press(tree, 'New');
    const created = await createCategory({ name: 'Bonus', kind: 'income' });
    await act(async () => {
      mockCategoryForm.current!.onSaved(created);
      await settle();
    });
    await save(tree);
    const foodId = (await mockDb.getFirstAsync<{ id: string }>(
      "SELECT id FROM categories WHERE name = 'Food'"
    ))!.id;
    expect((await saved()).map((r) => r.category_id)).toEqual([foodId]);
    act(() => tree.unmount());
  });

  it('saves once for five rapid taps on Save', async () => {
    const tree = await render();
    await press(tree, 'Food');
    await typeAmount(tree, '12.34');
    await act(async () => {
      const b = tree.root.find((n) => isSaveTitle(n.props.title) && typeof n.props.onPress === 'function');
      for (let i = 0; i < 5; i++) b.props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect((await saved()).map((r) => r.amount_minor)).toEqual([1234]);
    act(() => tree.unmount());
  });

  it('random splits either report a problem or sum exactly to the total', () => {
    for (let n = 0; n < 500; n++) {
      const total = Math.floor(rnd() * 1_000_000_000) + (rnd() < 0.1 ? 0 : 1);
      const parts: DraftPart[] = Array.from({ length: 2 + Math.floor(rnd() * 5) }, (_, i) => ({
        key: `k${i}`,
        categoryId: rnd() < 0.05 ? null : 'c',
        amountText: i === 0 ? '' : (rnd() * 5000).toFixed(Math.floor(rnd() * 4)),
      }));
      if (splitProblem(total, parts) === null) {
        const amounts = toSplitParts(total, parts).map((p) => p.amountMinor);
        expect(amounts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(amounts.every((a) => Number.isInteger(a) && a > 0)).toBe(true);
      } else expect(partAmounts(total, parts).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});
