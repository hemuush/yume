/**
 * Notification settings: a banner up top when the phone's permission is off, short row subtitles, and the
 * delivery check folded away under Troubleshooting until asked for.
 */
import { Text, Linking } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(90000);

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
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getNotificationPrefs: async () => ({
    morningEnabled: true,
    eveningEnabled: true,
    overspendAlerts: true,
    billAlerts: true,
    weeklySummary: false,
    suuCheckins: true,
    morningMinutes: 540,
    eveningMinutes: 1260,
  }),
  setNotificationPrefs: jest.fn(async () => {}),
}));
let mockPermitted = true;
jest.mock('@/lib/notifications', () => ({
  rebuildNotifications: async () => true,
  requestNotificationPermission: async () => true,
  sendTestNotification: async () => {},
  getNotificationDeliveryStatus: async () => ({
    permitted: mockPermitted,
    channelBlocked: false,
    scheduledCount: 4,
  }),
}));

import NotificationSettings from '../../../app/notification-settings';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<NotificationSettings />);
  });
  await act(async () => {});
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

describe('Notification settings', () => {
  beforeEach(() => {
    mockPermitted = true;
  });

  it('shows no banner while notifications are allowed, and keeps the delivery check folded', async () => {
    const shown = texts(await render());
    expect(shown).not.toContain('Notifications are off for Yume');
    expect(shown).toContain('Troubleshooting');
    expect(shown).not.toContain('Test notification');
  });

  it('says at the top when the phone permission is off, with a way to the phone settings', async () => {
    mockPermitted = false;
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const tree = await render();
    expect(texts(tree)).toContain('Notifications are off for Yume');
    const turnOn = tree.root.find(
      (n) => n.props.title === 'Turn on' && typeof n.props.onPress === 'function'
    );
    act(() => turnOn.props.onPress());
    expect(open).toHaveBeenCalled();
  });

  it('opens the delivery check on tap', async () => {
    const tree = await render();
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Delivery check' && typeof n.props.onPress === 'function')
        .props.onPress();
    });
    expect(texts(tree)).toContain('Test notification');
  });
});
