/**
 * Notification settings: a banner up top when the phone's permission is off, short row subtitles, and the
 * delivery check folded away under Troubleshooting until asked for.
 */
import { Text, Linking, AppState, type AppStateStatus } from 'react-native';
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
const initialPrefs = () => ({
  morningEnabled: true,
  eveningEnabled: true,
  overspendAlerts: true,
  billAlerts: true,
  weeklySummary: false,
  suuCheckins: true,
  recurringAlerts: true,
  morningHour: 9,
  morningMinute: 0,
  eveningHour: 21,
  eveningMinute: 0,
});
let mockPrefs = initialPrefs();
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getNotificationPrefs: jest.fn(async () => ({ ...mockPrefs })),
  updateNotificationPrefs: jest.fn(async (patch) => (mockPrefs = { ...mockPrefs, ...patch })),
}));
let mockPermitted = true;
let mockScheduledCount = 4;
jest.mock('@/lib/notifications', () => ({
  rebuildNotifications: jest.fn(async () => true),
  requestNotificationPermission: jest.fn(async () => true),
  sendTestNotification: async () => {},
  getNotificationDeliveryStatus: jest.fn(async () => ({
    permitted: mockPermitted,
    channelBlocked: false,
    scheduledCount: mockScheduledCount,
  })),
}));

import NotificationSettings from '../../../app/notification-settings';
import { emitSettingsRestored } from '@/lib/dataEvents';

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
    jest.clearAllMocks();
    mockPermitted = true;
    mockScheduledCount = 4;
    mockPrefs = initialPrefs();
    require('@/lib/notifications').rebuildNotifications.mockResolvedValue(true);
    require('@/db/settings').updateNotificationPrefs.mockImplementation(
      async (patch: object) => (mockPrefs = { ...mockPrefs, ...patch })
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows no banner while notifications are allowed, and keeps the delivery check folded', async () => {
    const shown = texts(await render());
    expect(shown).not.toContain('Notifications are off for Yume');
    expect(shown).toContain('Delivery');
    expect(shown).not.toContain('Test notification');
  });

  it('shows a failed settings refresh beside the loaded controls and clears it after retry', async () => {
    const { getNotificationPrefs } = require('@/db/settings');
    const tree = await render();
    getNotificationPrefs.mockRejectedValueOnce(new Error('Database busy'));
    await act(async () => emitSettingsRestored());
    expect(texts(tree)).toContain('Database busy');
    expect(texts(tree)).toContain('9:00 AM');
    await act(async () => {
      await tree.root.find((n) => n.props.title === 'Retry' && n.props.onPress).props.onPress();
    });
    expect(texts(tree)).not.toContain('Database busy');
    expect(texts(tree)).toContain('9:00 AM');
  });

  it('uses the same retry path when the initial settings read fails', async () => {
    require('@/db/settings').getNotificationPrefs.mockRejectedValueOnce(new Error('Initial read failed'));
    const tree = await render();
    expect(texts(tree)).toContain('Initial read failed');
    expect(texts(tree)).not.toContain('9:00 AM');
    await act(async () => {
      await tree.root.find((n) => n.props.title === 'Retry' && n.props.onPress).props.onPress();
    });
    expect(texts(tree)).not.toContain('Initial read failed');
    expect(texts(tree)).toContain('9:00 AM');
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

  it('steps a time by 30 minutes from its card, and shows how many of the mentions are on', async () => {
    const { updateNotificationPrefs } = require('@/db/settings');
    const tree = await render();
    expect(texts(tree)).toContain('3 of 5 on');
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Morning time 30 minutes later' && n.props.onPress)
        .props.onPress();
    });
    expect(updateNotificationPrefs).toHaveBeenCalledWith(
      expect.objectContaining({ morningHour: 9, morningMinute: 30 })
    );
  });

  it('never claims readiness with zero scheduled reminders', async () => {
    mockScheduledCount = 0;
    expect(texts(await render())).toContain('Nothing scheduled');
    expect(texts(await render())).not.toContain('Ready to notify');
  });

  it('keeps a saved preference and exposes failed scheduling without claiming readiness', async () => {
    require('@/lib/notifications').rebuildNotifications.mockResolvedValueOnce(false);
    const tree = await render();
    await act(async () => {
      await tree.root
        .find((n) => n.props.accessibilityLabel === 'Morning time 30 minutes later' && n.props.onPress)
        .props.onPress();
    });
    expect(mockPrefs.morningMinute).toBe(30);
    expect(texts(tree)).toContain('Reminders need rebuilding');
    expect(texts(tree)).not.toContain('Ready to notify');
  });

  it('refreshes permission status on return from phone settings without a route refocus', async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });
    mockPermitted = false;
    const tree = await render();
    expect(texts(tree)).toContain('Notifications are off for Yume');
    await act(async () => {
      listeners.forEach((callback) => callback('background'));
      mockPermitted = true;
      listeners.forEach((callback) => callback('active'));
    });
    expect(texts(tree)).not.toContain('Notifications are off for Yume');
    expect(texts(tree)).toContain('Ready to notify');
  });

  it('keeps a later choice after an earlier write fails, without persisting the failed change', async () => {
    const { updateNotificationPrefs } = require('@/db/settings');
    let rejectFirst!: (e: Error) => void;
    updateNotificationPrefs.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        })
    );
    const tree = await render();
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Morning time 30 minutes later' && n.props.onPress)
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Weekly wrap' && n.props.onChange)
        .props.onChange(true);
    });
    expect(updateNotificationPrefs).toHaveBeenCalledTimes(1);
    await act(async () => rejectFirst(new Error('Disk unavailable')));
    expect(updateNotificationPrefs).toHaveBeenNthCalledWith(2, { weeklySummary: true });
    expect(mockPrefs).toMatchObject({ morningHour: 9, morningMinute: 0, weeklySummary: true });
    expect(texts(tree)).toContain('9:00 AM');
    expect(
      tree.root.find((n) => n.props.accessibilityLabel === 'Weekly wrap' && n.props.onChange).props.value
    ).toBe(true);
  });

  it('discards an obsolete enabling result if the same switch was turned off while permission was pending', async () => {
    const { requestNotificationPermission } = require('@/lib/notifications');
    let allow!: (granted: boolean) => void;
    requestNotificationPermission.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          allow = resolve;
        })
    );
    const tree = await render();
    const weekly = () =>
      tree.root.find((n) => n.props.accessibilityLabel === 'Weekly wrap' && n.props.onChange);
    act(() => {
      void weekly().props.onChange(true);
    });
    await act(async () => {
      await weekly().props.onChange(false);
    });
    await act(async () => allow(true));
    expect(mockPrefs.weeklySummary).toBe(false);
    expect(weekly().props.value).toBe(false);
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

  it('opens the phone’s battery settings from the delivery check, or Yume’s own page if it cannot', async () => {
    const send = jest.spyOn(Linking, 'sendIntent').mockResolvedValue();
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const tree = await render();
    await act(async () => {
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Delivery check' && typeof n.props.onPress === 'function')
        .props.onPress();
    });
    const battery = () =>
      tree.root.find((n) => n.props.title === 'Battery settings' && typeof n.props.onPress === 'function');
    await act(async () => battery().props.onPress());
    expect(send).toHaveBeenCalledWith('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    expect(open).not.toHaveBeenCalled();
    send.mockRejectedValue(new Error('no such screen'));
    await act(async () => battery().props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
  });
});
