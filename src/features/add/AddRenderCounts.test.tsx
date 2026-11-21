/**
 * The Add screen on a real database: which parts are drawn again for what. Every part is counted through a wrapper that
 * renders the real one. A digit typed on the pad belongs to the amount and the Save button, and a sheet opening belongs to
 * the sheet: neither redraws the header, the category grid or the rest of the page.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
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
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn(), select: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return { useSafeAreaInsets: () => insets };
});
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: require('react-native').View,
  KeyboardProvider: ({ children }: { children: unknown }) => children,
  useKeyboardState: () => false,
  KeyboardAwareScrollView: require('react-native').View,
  KeyboardStickyView: require('react-native').View,
}));
jest.mock('@/features/home/SkyHeader', () => ({
  SkyHeader: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/profile/AddAccountModal', () => ({ AddAccountModal: () => null }));
const mockCalendar: { current: { visible: boolean; onClose: () => void } | null } = { current: null };
jest.mock('@/components/CalendarSheet', () => ({
  CalendarSheet: (props: { visible: boolean; onClose: () => void }) => {
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
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ dispatch: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn() }));

// How often each part was drawn. A function declaration, so the hoisted mocks below can use it.
const mockDrawn = { header: 0, amount: 0, fields: 0, footer: 0, sheets: 0, picker: 0, detailRow: 0 };
function mockWrap(actual: Record<string, unknown>, exportName: string, key: keyof typeof mockDrawn) {
  return {
    ...actual,
    [exportName]: (props: unknown) => {
      mockDrawn[key]++;
      return (actual[exportName] as (p: unknown) => unknown)(props);
    },
  };
}
jest.mock('@/features/add/components/AddEntryHeader', () =>
  mockWrap(jest.requireActual('@/features/add/components/AddEntryHeader'), 'AddEntryHeader', 'header')
);
jest.mock('@/features/add/components/AddEntryAmount', () =>
  mockWrap(jest.requireActual('@/features/add/components/AddEntryAmount'), 'AddEntryAmount', 'amount')
);
jest.mock('@/features/add/components/AddEntryFields', () =>
  mockWrap(jest.requireActual('@/features/add/components/AddEntryFields'), 'AddEntryFields', 'fields')
);
jest.mock('@/features/add/components/AddEntryFooter', () =>
  mockWrap(jest.requireActual('@/features/add/components/AddEntryFooter'), 'AddEntryFooter', 'footer')
);
jest.mock('@/features/add/components/AddEntrySheets', () =>
  mockWrap(jest.requireActual('@/features/add/components/AddEntrySheets'), 'AddEntrySheets', 'sheets')
);
jest.mock('@/components/CategoryPicker', () =>
  mockWrap(jest.requireActual('@/components/CategoryPicker'), 'CategoryPicker', 'picker')
);
jest.mock('@/features/add/AddDetailRow', () =>
  mockWrap(jest.requireActual('@/features/add/AddDetailRow'), 'AddDetailRow', 'detailRow')
);

import AddTransactionScreen from '../../../app/add-transaction';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { resetSettingsCache, setDefaultCurrency } from '@/db/settings';

beforeEach(async () => {
  mockParams.current = {};
  mockCalendar.current = null;
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  await setDefaultCurrency('INR');
  await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1_000_000 });
  await createCategory({ name: 'Food', kind: 'expense' });
  await createCategory({ name: 'Transport', kind: 'expense' });
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
const reset = () => Object.keys(mockDrawn).forEach((key) => (mockDrawn[key as keyof typeof mockDrawn] = 0));
const key = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
const tap = (tree: ReactTestRenderer, label: string) => act(async () => key(tree, label).props.onPress());

it('shows the amount, the category grid, the pad and the Save button', async () => {
  const tree = await render();
  expect(mockDrawn.header).toBeGreaterThan(0);
  expect(mockDrawn.picker).toBeGreaterThan(0);
  expect(key(tree, '7')).toBeTruthy();
  expect(
    tree.root.find((n) => n.props.title === 'Save' && typeof n.props.onPress === 'function')
  ).toBeTruthy();
});

it('draws the amount and the Save button for a typed digit, and not the header, the grid or the sheets', async () => {
  const tree = await render();
  await tap(tree, '7');
  reset();
  await tap(tree, '5');
  await tap(tree, '0');
  expect(mockDrawn.amount).toBeGreaterThan(0);
  expect(mockDrawn.footer).toBeGreaterThan(0);
  expect(mockDrawn.header).toBe(0);
  expect(mockDrawn.sheets).toBe(0);
  expect(mockDrawn.picker).toBe(0);
  // The pad and the account, date and note row, which hold nothing of the amount, are not drawn again either.
  expect(mockDrawn.detailRow).toBe(0);
});

it('names the amount on the Save button as it is typed', async () => {
  const tree = await render();
  await tap(tree, '7');
  await tap(tree, '5');
  await tap(tree, '0');
  const save = tree.root.find((n) => typeof n.props.title === 'string' && n.props.title.startsWith('Save'));
  expect(save.props.title).toContain('750');
});

it('does not redraw the page behind the date sheet when it opens or closes', async () => {
  const tree = await render();
  await tap(tree, '7');
  reset();
  await act(async () =>
    tree.root.findAll((n) => typeof n.props.onPickDate === 'function')[0].props.onPickDate()
  );
  expect(mockCalendar.current?.visible).toBe(true);
  await act(async () => mockCalendar.current!.onClose());
  expect(mockCalendar.current?.visible).toBe(false);
  expect(mockDrawn.sheets).toBeGreaterThan(0);
  expect(mockDrawn.header).toBe(0);
  expect(mockDrawn.amount).toBe(0);
  expect(mockDrawn.fields).toBe(0);
  expect(mockDrawn.footer).toBe(0);
  expect(mockDrawn.picker).toBe(0);
});

it('does not redraw the header or the sheets when a category is picked', async () => {
  const tree = await render();
  reset();
  await act(async () => key(tree, 'Food').props.onPress());
  expect(mockDrawn.header).toBe(0);
  expect(mockDrawn.sheets).toBe(0);
});
