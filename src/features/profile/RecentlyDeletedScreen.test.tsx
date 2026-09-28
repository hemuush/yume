/**
 * The Recently deleted screen: shows what was deleted with the days it has
 * left, restores one, hides Restore when an entry can't come back, and shows
 * the empty state when nothing's there. All figures are made up.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
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
jest.mock('@/db/accounts', () => ({ listAccounts: async () => [{ id: 'bank', name: 'HDFC' }] }));
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
  return r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .join(' | ');
}

async function render() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<RecentlyDeletedScreen />);
  });
  return r;
}

describe('Recently deleted screen', () => {
  it('lists deleted entries with the days they have left, and restores one', async () => {
    mockEntries.current = [entry({})];
    const r = await render();
    expect(texts(r)).toContain('Food & Dining');
    expect(texts(r)).toMatch(/Lunch · 26 Sept? · 30 days left/);
    const restore = r.root.find(
      (n) => n.props.accessibilityLabel === 'Restore Food & Dining, Lunch' && n.props.onPress
    );
    await act(async () => restore.props.onPress());
    expect(mockRestore).toHaveBeenCalledWith('t1');
    act(() => r.unmount());
  });

  it("shows why an entry can't come back, with no Restore button", async () => {
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
