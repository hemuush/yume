/**
 * The Needs you screen: dismissing or snoozing hides the row at once, and puts it back (with an error) when
 * the write fails, instead of leaving a dismissal on screen that was never saved.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(120000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#A6B4F2', secondary: '#8FE8C8' }),
}));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
const mockShowAlert = jest.fn();
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockShowAlert(...a) }));
jest.mock('@/features/home/NeedsYouRow', () => ({
  NeedsYouRow: () => null,
}));
jest.mock('@/db/reports', () => ({ getPeriodComparison: async () => ({ expenseChangePct: null }) }));
jest.mock('@/db/ledger', () => ({ listAccounts: async () => [] }));
jest.mock('@/db/settings', () => ({
  getNotificationPrefs: async () => ({ suuCheckins: false }),
  getCachedHideSensitiveAmounts: () => false,
}));
const mockData = {
  loadNeedsYou: jest.fn(),
  dismissNeedsYou: jest.fn(),
  restoreNeedsYou: jest.fn(),
  snoozeBackupReminder: jest.fn(),
};
jest.mock('@/features/home/needsYouData', () => ({
  loadNeedsYou: (...a: unknown[]) => mockData.loadNeedsYou(...a),
  dismissNeedsYou: (...a: unknown[]) => mockData.dismissNeedsYou(...a),
  restoreNeedsYou: (...a: unknown[]) => mockData.restoreNeedsYou(...a),
  snoozeBackupReminder: (...a: unknown[]) => mockData.snoozeBackupReminder(...a),
}));

import { NeedsYouRow } from '@/features/home/NeedsYouRow';
import NeedsYouScreen from '../../../app/notifications';

const item = (key: string, over = {}) => ({
  key,
  tone: 'warn' as const,
  title: `Item ${key}`,
  detail: 'detail',
  action: 'budgets' as const,
  ...over,
});

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<NeedsYouScreen />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree;
}
const rows = (tree: ReactTestRenderer) => tree.root.findAllByType(NeedsYouRow);
const keys = (tree: ReactTestRenderer) => rows(tree).map((r) => r.props.item.key);

beforeEach(() => {
  jest.clearAllMocks();
  mockData.loadNeedsYou.mockResolvedValue({
    shown: [item('a'), item('b', { snoozable: true, action: 'backup' }), item('c')],
    dismissed: [],
  });
  mockData.dismissNeedsYou.mockResolvedValue(undefined);
  mockData.restoreNeedsYou.mockResolvedValue(undefined);
  mockData.snoozeBackupReminder.mockResolvedValue(undefined);
});

// Warms React Native's lazily-required modules once, with a generous budget.
beforeAll(async () => {
  mockData.loadNeedsYou.mockResolvedValue({ shown: [], dismissed: [] });
  await render();
}, 180000);

it('dismisses a row, saves it, and offers Undo', async () => {
  const tree = await render();
  await act(async () => {
    await rows(tree)[1].props.onDismiss();
  });
  expect(keys(tree)).toEqual(['a', 'c']);
  expect(mockData.dismissNeedsYou).toHaveBeenCalledWith('b');
  expect(mockShowUndo).toHaveBeenCalledTimes(1);
  expect(mockShowAlert).not.toHaveBeenCalled();
});

it('puts a row back in its place, with an error and no Undo, when saving the dismissal fails', async () => {
  mockData.dismissNeedsYou.mockRejectedValue(new Error('disk full'));
  const tree = await render();
  await act(async () => {
    await rows(tree)[1].props.onDismiss();
  });
  expect(keys(tree)).toEqual(['a', 'b', 'c']);
  expect(mockShowAlert).toHaveBeenCalledWith("Couldn't dismiss", expect.stringContaining('disk full'));
  expect(mockShowUndo).not.toHaveBeenCalled();
});

it('snoozes a row away, and brings it back if the snooze cannot be saved', async () => {
  const tree = await render();
  await act(async () => {
    await rows(tree)[1].props.onSnooze();
  });
  expect(keys(tree)).toEqual(['a', 'c']);

  mockData.snoozeBackupReminder.mockRejectedValue(new Error('locked'));
  const again = await render();
  await act(async () => {
    await rows(again)[1].props.onSnooze();
  });
  expect(keys(again)).toEqual(['a', 'b', 'c']);
  expect(mockShowAlert).toHaveBeenCalledWith("Couldn't snooze", expect.stringContaining('locked'));
});
