/**
 * What the notification settings draw again for a switch: flipping one draws the page once (not once for the choice, once
 * for the saved answer and once for the delivery check), and only the row that changed.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(90000);

// Answers arrive a little later, each on its own, like the real database's.
const mockLater = <T,>(value: T, ms = 15) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn() } }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn() }));
// Every settings row asks for its label once each time it is drawn.
const mockDrawn = { rows: [] as string[], page: 0 };
jest.mock('@/components/SettingsRow', () => {
  const actual = jest.requireActual('@/components/SettingsRow');
  return {
    ...actual,
    SettingsRow: (props: { label: string }) => {
      mockDrawn.rows.push(props.label);
      return actual.SettingsRow(props);
    },
  };
});
// The day's arc is drawn by the page itself, once each time the page is drawn.
jest.mock('@/features/notifications/DayArc', () => ({
  DayArc: () => {
    mockDrawn.page++;
    return null;
  },
}));
const initialPrefs = () => ({
  morningEnabled: true,
  eveningEnabled: true,
  overspendAlerts: true,
  billAlerts: true,
  weeklySummary: false,
  suuCheckins: true,
  recurringAlerts: true,
  refundAlerts: true,
  morningHour: 9,
  morningMinute: 0,
  eveningHour: 21,
  eveningMinute: 0,
});
let mockPrefs = initialPrefs();
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getNotificationPrefs: jest.fn(async () => ({ ...mockPrefs })),
  updateNotificationPrefs: jest.fn(async (patch) => mockLater((mockPrefs = { ...mockPrefs, ...patch }))),
}));
jest.mock('@/lib/notifications', () => ({
  rebuildNotifications: jest.fn(async () => mockLater(true)),
  requestNotificationPermission: jest.fn(async () => true),
  sendTestNotification: async () => {},
  // A fresh object every time, as every read of the real status is.
  getNotificationDeliveryStatus: jest.fn(async () =>
    mockLater({ permitted: true, channelBlocked: false, scheduledCount: 4 })
  ),
}));

import NotificationSettings from '../../../app/notification-settings';

let mounted: ReactTestRenderer | null = null;
const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function render() {
  await act(async () => {
    mounted = create(<NotificationSettings />);
  });
  await settle(20);
  return mounted!;
}
// The tap is not awaited: each answer (the choice, the saved settings, the delivery check) arrives on its own, as it does
// from the database, so each would be a draw of its own.
const flip = (tree: ReactTestRenderer, label: string) =>
  act(() => {
    const target = tree.root.find(
      (n) => n.props.accessibilityLabel === label && typeof n.props.onChange === 'function'
    );
    void target.props.onChange(!target.props.value);
  });

beforeEach(() => {
  mockPrefs = initialPrefs();
  Object.assign(mockDrawn, { rows: [], page: 0 });
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
});

it('shows each choice at once and keeps it once saved', async () => {
  const tree = await render();
  const valueOf = (label: string) =>
    tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onChange === 'function')
      .props.value;
  expect(valueOf('Weekly wrap')).toBe(false);
  await flip(tree, 'Weekly wrap');
  await settle(5);
  expect(valueOf('Weekly wrap')).toBe(true);
  await settle(50);
  await settle(50);
  expect(valueOf('Weekly wrap')).toBe(true);
  expect(mockPrefs.weeklySummary).toBe(true);
  expect(tree.root.findAllByType(Text).length).toBeGreaterThan(0);
});

it('draws the page once for a switch, however many answers come back', async () => {
  const tree = await render();
  await settle(100);
  const drawn = mockDrawn.page;
  await flip(tree, 'Weekly wrap');
  await settle(50);
  await settle(50);
  await settle(50);
  expect(mockDrawn.page - drawn).toBe(1);
});

it('draws only the row of the switch that changed', async () => {
  const tree = await render();
  await settle(100);
  const drawn = mockDrawn.rows.length;
  await flip(tree, 'Weekly wrap');
  await settle(50);
  await settle(50);
  await settle(50);
  expect(mockDrawn.rows.slice(drawn)).toEqual(['Weekly wrap']);
});
