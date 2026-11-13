/**
 * The Recently deleted screen: lists deleted items with days left, restores one, hides Restore when an entry
 * can't come back, and shows the empty state. Made-up figures.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn() } }));
jest.mock('@/db/categories', () => ({
  listCategories: async () => [
    { id: 'food', name: 'Food & Dining', icon: 'food', color: '#FF9E7D', isSensitive: false },
  ],
}));
jest.mock('@/db/accounts', () => ({
  listAccounts: async () => [
    { id: 'bank', name: 'HDFC', currency: 'INR' },
    { id: 'usd', name: 'Wise', currency: 'USD' },
  ],
}));
const mockEntries = { current: [] as unknown[] };
const mockRestore = jest.fn(async (_id: string) => {});
jest.mock('@/db/recentlyDeleted', () => ({
  listDeletedEntries: async () => mockEntries.current,
  restoreDeletedEntry: (id: string) => mockRestore(id),
  emptyDeletedEntries: jest.fn(async () => {}),
}));

import RecentlyDeletedScreen from '../../../app/recently-deleted';
import { showAlert } from '@/components/AppDialog';

const entry = (over: Record<string, unknown>) => ({
  id: 't1',
  type: 'expense',
  amountMinor: 18_000,
  date: '2026-09-26',
  note: 'Lunch',
  categoryId: 'food',
  accountId: 'bank',
  deletedAt: new Date().toISOString(),
  daysLeft: 30,
  blockedReason: null,
  ...over,
});

function texts(r: ReactTestRenderer): string {
  return (
    r.root
      .findAllByType(Text)
      // The pieces of a caption are glued with non-breaking spaces; read them as people do.
      .map((t) =>
        [t.props.children]
          .flat(Infinity)
          .join('')
          .replace(/\u00A0/g, ' ')
      )
      .join(' | ')
  );
}

async function render() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<RecentlyDeletedScreen />);
  });
  return r;
}

describe('Recently deleted screen', () => {
  it('shows an entry in its own account’s currency and names the year of an old one', async () => {
    mockEntries.current = [
      entry({ id: 'u1', accountId: 'usd', amountMinor: 5_000, note: 'Hostel', date: '2025-03-04' }),
    ];
    const r = await render();
    const shown = texts(r);
    expect(shown).toContain('$50');
    expect(shown).not.toContain('₹50');
    // What it was on one line, when and how long on the next.
    expect(shown).toMatch(/Hostel \| 4 Mar 2025 · 30 days left/);
  });

  it('lists deleted entries with the days they have left, and restores one', async () => {
    mockEntries.current = [entry({})];
    const r = await render();
    expect(texts(r)).toContain('Food & Dining');
    expect(texts(r)).toMatch(/Lunch \| 26 Sept? · 30 days left/);
    const restore = r.root.find(
      (n) => n.props.accessibilityLabel === 'Restore Food & Dining, Lunch' && n.props.onPress
    );
    await act(async () => restore.props.onPress());
    expect(mockRestore).toHaveBeenCalledWith('t1');
    act(() => r.unmount());
  });

  it('counts what is waiting and says when the oldest one leaves', async () => {
    mockEntries.current = [
      entry({ id: 't1', daysLeft: 30 }),
      entry({ id: 't2', daysLeft: 4 }),
      entry({ id: 't3', daysLeft: 12 }),
    ];
    const r = await render();
    const shown = texts(r);
    expect(shown).toContain('Waiting to be restored');
    expect(shown).toContain('entries');
    expect(shown).toContain('Oldest leaves in 4 days');
    expect(shown).toContain('then gone for good');
    act(() => r.unmount());
  });

  it('says day, not days, for a single day left, and entry for a single entry', async () => {
    mockEntries.current = [entry({ daysLeft: 1 })];
    const r = await render();
    const shown = texts(r);
    expect(shown).toContain('Oldest leaves in 1 day');
    expect(shown).toMatch(/\| 1 \| entry \|/);
    act(() => r.unmount());
  });

  it('shows why an entry can’t come back, with no Restore button', async () => {
    mockEntries.current = [entry({ blockedReason: 'Its account no longer exists' })];
    const r = await render();
    expect(texts(r)).toContain('Its account no longer exists');
    expect(
      r.root.findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Restore')
      )
    ).toHaveLength(0);
    act(() => r.unmount());
  });

  it('asks before deleting everything for good', async () => {
    mockEntries.current = [entry({})];
    const alert = jest.mocked(showAlert);
    const r = await render();
    const all = r.root.findAll(
      (n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function'
    );
    const emptyButton = all.find((n) =>
      n.findAllByType(Text).some((t) => t.props.children === 'Delete all for good')
    )!;
    act(() => emptyButton.props.onPress());
    expect(alert).toHaveBeenCalledWith(
      'Delete all for good?',
      expect.stringContaining('1 entry'),
      expect.any(Array)
    );
    alert.mockRestore();
    act(() => r.unmount());
  });

  it('shows the empty state when nothing is there', async () => {
    mockEntries.current = [];
    const r = await render();
    expect(texts(r)).toContain('Nothing here');
    act(() => r.unmount());
  });
});

describe('a big tidy-up', () => {
  const restoreButtons = (r: ReactTestRenderer) =>
    r.root.findAll((n) => /^Restore /.test(String(n.props.accessibilityLabel)) && !!n.props.onPress);

  it('draws a hundred rows at a time, while the count and Delete all still cover every entry', async () => {
    mockEntries.current = Array.from({ length: 250 }, (_, i) => entry({ id: `bulk${i}`, daysLeft: 30 }));
    const r = await render();
    expect(restoreButtons(r)).toHaveLength(100);
    expect(texts(r)).toContain('250');
    const more = () =>
      r.root.find(
        (n) =>
          typeof n.props.onPress === 'function' &&
          n.findAllByType(Text).some((t) => /^Show \d+ more$/.test(String(t.props.children)))
      );
    expect(more().findByType(Text).props.children).toBe('Show 100 more');
    await act(async () => more().props.onPress());
    expect(restoreButtons(r)).toHaveLength(200);
    await act(async () => more().props.onPress());
    expect(restoreButtons(r)).toHaveLength(250);
    expect(texts(r)).not.toMatch(/Show \d+ more/);
    act(() => r.unmount());
  });

  it('offers no Show more when everything fits', async () => {
    mockEntries.current = Array.from({ length: 100 }, (_, i) => entry({ id: `fit${i}` }));
    const r = await render();
    expect(restoreButtons(r)).toHaveLength(100);
    expect(texts(r)).not.toMatch(/Show \d+ more/);
    act(() => r.unmount());
  });
});

describe('a long note', () => {
  it('is cut on its own line, so the date and the days left are still shown whole', async () => {
    mockEntries.current = [entry({ id: 'n1', note: 'x'.repeat(120), date: '2025-03-04' })];
    const r = await render();
    // The shared Text drops a one-line limit at large text sizes; what the screen asks for is on its own props.
    const cut = r.root.findAll(
      (n) => n.props.numberOfLines === 1 && String(n.props.children).startsWith('xxx')
    );
    expect(cut.length).toBeGreaterThan(0);
    expect(texts(r)).toMatch(/4 Mar 2025 · 30 days left/);
    // The time left is not in the line that gets cut.
    cut.forEach((n) => expect(String(n.props.children)).not.toMatch(/days left/));
  });
});
