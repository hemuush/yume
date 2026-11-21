/**
 * Friends & family assembled on a real database: which sheets open, and what does not make the tiles behind them redraw.
 * Each tile is counted through the one helper every tile and row calls once per draw; the sheets are stand-ins that record
 * what they were given.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(90000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null, HeaderIconButton: () => null }));
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
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

// Every tile and every settled row asks for the person's initials once each time it is drawn.
const mockDrawn: { people: string[] } = { people: [] };
jest.mock('@/features/people/people.helpers', () => {
  const actual = jest.requireActual('@/features/people/people.helpers');
  return {
    ...actual,
    personInitials: (name: string) => {
      mockDrawn.people.push(name);
      return actual.personInitials(name);
    },
  };
});
const mockSheet: {
  person: string | null;
  closePerson: (() => void) | null;
  adding: boolean;
  closeAdd: (() => void) | null;
} = { person: null, closePerson: null, adding: false, closeAdd: null };
jest.mock('@/features/people/PersonDetailModal', () => ({
  PersonDetailModal: (props: { person: { id: string }; onClose: () => void }) => {
    mockSheet.person = props.person.id;
    mockSheet.closePerson = props.onClose;
    return null;
  },
}));
jest.mock('@/features/people/AddPersonModal', () => ({
  AddPersonModal: (props: { visible: boolean; onClose: () => void }) => {
    mockSheet.adding = props.visible;
    mockSheet.closeAdd = props.onClose;
    return null;
  },
}));

import { Text } from 'react-native';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { addLedgerEntry, createPerson } from '@/db/people';
import { clearReadCache } from '@/db/readCache';
import { resetSettingsCache, setDefaultCurrency, setHasOnboarded, setUserName } from '@/db/settings';
import { toLocalIsoDate } from '@/lib/date';
import PeopleScreen from '../../app/people';

const today = toLocalIsoDate(new Date());
let mounted: ReactTestRenderer | null = null;
const ids: Record<string, string> = {};

async function seed() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  clearReadCache();
  await setDefaultCurrency('INR');
  await setUserName('Tester');
  await setHasOnboarded(true);
  for (const [name, amountMinor] of [
    ['Aarav', 240_000],
    ['Diya', -100_000],
    ['Meera', 50_000],
    ['Riya', 0],
  ] as const) {
    const person = await createPerson({ name });
    ids[name] = person.id;
    if (amountMinor !== 0) await addLedgerEntry({ personId: person.id, amountMinor, date: today });
  }
}

const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function openPeople() {
  await act(async () => {
    mounted = create(<PeopleScreen />);
  });
  await settle(50);
  await settle(50);
  return mounted!;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat(5).join(''));
const showAgain = () =>
  act(async () => {
    mockFocus.forEach((cb) => {
      const undo = cb();
      if (typeof undo === 'function') mockUndo.push(undo);
    });
  });
const tapPerson = (tree: ReactTestRenderer, label: string) => {
  const target = tree.root.find(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel?.startsWith(label)
  );
  act(() => target.props.onPress());
};

beforeEach(async () => {
  mockFocus.clear();
  mockDrawn.people = [];
  Object.assign(mockSheet, { person: null, closePerson: null, adding: false, closeAdd: null });
  await seed();
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  // A focus effect that was run by hand leaves its timer (the one to the next midnight) until undone.
  mockUndo.splice(0).forEach((undo) => undo());
});

it('lists everyone, open balances first and the settled ones in their own card', async () => {
  const tree = await openPeople();
  const shown = texts(tree);
  expect(shown.indexOf('Aarav')).toBeLessThan(shown.indexOf('Meera'));
  expect(shown).toEqual(expect.arrayContaining(['Owes you', 'You owe', 'Settled', 'Diya', 'Riya']));
  expect(new Set(mockDrawn.people)).toEqual(new Set(['Aarav', 'Diya', 'Meera', 'Riya']));
});

it('opens a person from their tile and from the settled list, and the form from the header', async () => {
  const tree = await openPeople();
  tapPerson(tree, 'Aarav');
  expect(mockSheet.person).toBe(ids.Aarav);
  act(() => mockSheet.closePerson!());
  tapPerson(tree, 'Riya');
  expect(mockSheet.person).toBe(ids.Riya);
  const add = tree.root.find((n) => typeof n.props.onPress === 'function' && n.props.label === '+ Person');
  act(() => add.props.onPress());
  expect(mockSheet.adding).toBe(true);
  act(() => mockSheet.closeAdd!());
  expect(mockSheet.adding).toBe(false);
});

it('does not redraw a tile or a row when a sheet opens or closes', async () => {
  const tree = await openPeople();
  await settle(200);
  const drawn = mockDrawn.people.length;
  expect(drawn).toBeGreaterThan(0);
  tapPerson(tree, 'Aarav');
  act(() => mockSheet.closePerson!());
  tapPerson(tree, 'Riya');
  act(() => mockSheet.closePerson!());
  const add = tree.root.find((n) => typeof n.props.onPress === 'function' && n.props.label === '+ Person');
  act(() => add.props.onPress());
  act(() => mockSheet.closeAdd!());
  expect(mockDrawn.people.length).toBe(drawn);
});

it('draws nothing again for a reload that found the same people', async () => {
  await openPeople();
  await settle(200);
  const drawn = mockDrawn.people.length;
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.people.length).toBe(drawn);
});

it('draws only the person whose balance changed', async () => {
  await openPeople();
  await settle(200);
  const drawn = mockDrawn.people.length;
  await addLedgerEntry({ personId: ids.Meera, amountMinor: 10_000, date: today });
  clearReadCache();
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.people.slice(drawn)).toEqual(['Meera']);
});
