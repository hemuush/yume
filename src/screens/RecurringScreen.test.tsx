/**
 * Recurring assembled on a real database: what it shows, which sheets open, and what does not make the page behind them
 * redraw. The rules and the hero are counted through wrappers that render the real ones; the rule form is a stand-in that
 * records what it was given.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(90000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn(), select: jest.fn() },
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null, HeaderIconButton: () => null }));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
  PrivacyProvider: ({ children }: { children: unknown }) => children,
}));
// Sheets show their content only while open; the real one needs the keyboard controller's native module.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, title, visible }: { children: unknown; title?: string; visible: boolean }) =>
    visible
      ? require('react').createElement(
          require('react').Fragment,
          null,
          require('react').createElement(require('react-native').Text, null, title),
          children
        )
      : null,
}));
// Every focus effect the page has registered; "showing the screen again" runs them and keeps what they return to undo.
const mockFocus = new Set<() => void | (() => void)>();
const mockUndo: (() => void)[] = [];
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void | (() => void)) => {
    mockFocus.add(cb);
    require('react').useEffect(cb, [cb]);
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    useSafeAreaInsets: () => inset,
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
  };
});

const mockDrawn: { rows: string[] } = { rows: [] };
const mockForm: { visible: boolean; editing: string | null; close: (() => void) | null } = {
  visible: false,
  editing: null,
  close: null,
};
jest.mock('@/features/recurring/RuleRow', () => {
  const actual = jest.requireActual('@/features/recurring/RuleRow');
  return {
    RuleRow: (props: { rule: { id: string } }) => {
      mockDrawn.rows.push(props.rule.id);
      return actual.RuleRow(props);
    },
  };
});
jest.mock('@/features/recurring/RuleModal', () => ({
  RuleModal: (props: { visible: boolean; editing: { id: string } | null; onClose: () => void }) => {
    mockForm.visible = props.visible;
    mockForm.editing = props.editing?.id ?? null;
    mockForm.close = props.onClose;
    return null;
  },
}));
jest.mock('@/features/profile/AddAccountModal', () => ({ AddAccountModal: () => null }));

import { Text } from 'react-native';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { clearReadCache } from '@/db/readCache';
import { createRecurringRule } from '@/db/recurring';
import { resetSettingsCache, setDefaultCurrency, setHasOnboarded, setUserName } from '@/db/settings';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { RuleRow } from '@/features/recurring/RuleRow';
import RecurringWorkspace from '@/features/recurring/RecurringWorkspace';

const today = toLocalIsoDate(new Date());
let mounted: ReactTestRenderer | null = null;
let ids: Record<string, string> = {};

async function seed() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  clearReadCache();
  await setDefaultCurrency('INR');
  await setUserName('Tester');
  await setHasOnboarded(true);
  const bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 5_000_000 })
  ).id;
  const category = (await createCategory({ name: 'Bills', kind: 'expense' })).id;
  ids = {};
  for (const [name, amountMinor, days] of [
    ['Rent', 1_800_000, 3],
    ['Netflix', 64_900, 1],
    ['Gym', 120_000, 9],
  ] as const) {
    const made = await createRecurringRule({
      type: 'expense',
      accountId: bank,
      categoryId: category,
      amountMinor,
      note: name,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: addDaysToIsoDate(today, days),
    });
    ids[name] = made.id;
  }
}

const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function openRecurring(scheduledRuleIds?: ReadonlySet<string>) {
  await act(async () => {
    mounted = create(<RecurringWorkspace scheduledRuleIds={scheduledRuleIds} />);
  });
  await settle(50);
  await settle(50);
  return mounted!;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat(5).join(''));
const rows = (tree: ReactTestRenderer) => tree.root.findAllByType(RuleRow);
const showAgain = () =>
  act(async () => {
    mockFocus.forEach((cb) => {
      const undo = cb();
      if (typeof undo === 'function') mockUndo.push(undo);
    });
  });

beforeEach(async () => {
  mockFocus.clear();
  Object.assign(mockDrawn, { rows: [] });
  Object.assign(mockForm, { visible: false, editing: null, close: null });
  await seed();
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  // A focus effect that was run by hand leaves its timer (the one to the next midnight) until undone.
  mockUndo.splice(0).forEach((undo) => undo());
});

it('lists the running rules, the biggest first', async () => {
  const tree = await openRecurring();
  expect(texts(tree)).toContain('Outside this schedule');
  expect(rows(tree).map((r) => r.props.rule.id)).toEqual([ids.Rent, ids.Gym, ids.Netflix]);
});

it('opens a rule’s form from its row, and closes it', async () => {
  const tree = await openRecurring();
  act(() => rows(tree)[1].props.onPress());
  expect(mockForm).toMatchObject({ visible: true, editing: ids.Gym });
  act(() => mockForm.close!());
  expect(mockForm).toMatchObject({ visible: false, editing: null });
});

it('omits rules already shown in the payment schedule', async () => {
  const tree = await openRecurring(new Set([ids.Rent, ids.Netflix]));
  expect(rows(tree).map((row) => row.props.rule.id)).toEqual([ids.Gym]);
});

it('does not redraw the rules when a sheet opens or closes', async () => {
  const tree = await openRecurring();
  await settle(200);
  const drawn = mockDrawn.rows.length;
  act(() => rows(tree)[0].props.onPress());
  act(() => mockForm.close!());
  expect(mockDrawn.rows.length).toBe(drawn);
});

it('draws nothing again for a reload that found the same rules', async () => {
  await openRecurring();
  await settle(200);
  const drawn = mockDrawn.rows.length;
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.rows.length).toBe(drawn);
});

it('moves a paused rule under "Paused rules", writes it, and leaves the other rules’ rows alone', async () => {
  const tree = await openRecurring();
  await settle(200);
  const drawn = mockDrawn.rows.length;
  const netflix = rows(tree).find((r) => r.props.rule.id === ids.Netflix)!;
  await act(async () => netflix.props.onTogglePause());
  await settle(100);
  await settle(100);
  expect(texts(tree)).toContain('Paused rules');
  const saved = await mockDb.getFirstAsync<{ active: number }>(
    'SELECT active FROM recurring_rules WHERE id = ?',
    [ids.Netflix]
  );
  expect(saved?.active).toBe(0);
  // Rent and Gym come before Netflix in the running list, so they keep their place and are not drawn again.
  const again = mockDrawn.rows.slice(drawn);
  expect(again).not.toContain(ids.Rent);
  expect(again).not.toContain(ids.Gym);
  expect(again).toContain(ids.Netflix);
});
