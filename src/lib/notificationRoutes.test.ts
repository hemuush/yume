import { Platform } from 'react-native';
/**
 * Notification taps: each carries the screen to open, and only routes on the fixed list are honoured.
 * The cold-start response is cleared once read, so it can't reopen that screen on every later launch.
 */
import * as Notifications from 'expo-notifications';
import {
  getNotificationDeliveryStatus,
  requestNotificationPermission,
  sendTestNotification,
  notificationRoute,
  rebuildNotifications,
  subscribeToNotificationTaps,
  NOTIFICATION_ROUTES,
} from './notifications';
import { getAlertQueue, getNotificationPrefs, setAlertQueue } from '@/db/settings';
import { hasLoggedOn, listLoansDue } from '@/db/notificationData';

jest.mock('@/db/settings', () => ({
  getNotificationPrefs: jest.fn(),
  getAlertQueue: jest.fn(),
  setAlertQueue: jest.fn(),
}));
jest.mock('@/db/notificationData', () => ({ listLoansDue: jest.fn(), hasLoggedOn: jest.fn() }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const response = (data: Record<string, unknown> | undefined) =>
  ({ notification: { request: { content: { data } } } }) as unknown as Notifications.NotificationResponse;

describe('notificationRoute', () => {
  it('returns a known route from the payload', () => {
    for (const route of NOTIFICATION_ROUTES) expect(notificationRoute(response({ url: route }))).toBe(route);
  });

  it('ignores anything not on the fixed list', () => {
    expect(notificationRoute(response({ url: '/backup' }))).toBeNull();
    expect(notificationRoute(response({ url: 'https://example.com' }))).toBeNull();
    expect(notificationRoute(response({ url: 42 }))).toBeNull();
    expect(notificationRoute(response(undefined))).toBeNull();
    expect(notificationRoute(null)).toBeNull();
  });
});

describe('subscribeToNotificationTaps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    N.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() } as any);
    N.clearLastNotificationResponse.mockReturnValue(undefined as any);
  });

  it('opens the route of the notification that launched the app, and clears it', async () => {
    N.getLastNotificationResponse.mockReturnValue(response({ url: '/add-transaction' }));
    const onRoute = jest.fn();
    subscribeToNotificationTaps(onRoute);
    await new Promise((r) => setImmediate(r));
    expect(onRoute).toHaveBeenCalledWith('/add-transaction');
    expect(N.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('does nothing on a normal launch', async () => {
    N.getLastNotificationResponse.mockReturnValue(null);
    const onRoute = jest.fn();
    subscribeToNotificationTaps(onRoute);
    await new Promise((r) => setImmediate(r));
    expect(onRoute).not.toHaveBeenCalled();
    expect(N.clearLastNotificationResponse).not.toHaveBeenCalled();
  });

  it('routes a tap while the app is running, and stops after unsubscribing', async () => {
    N.getLastNotificationResponse.mockReturnValue(null);
    const remove = jest.fn();
    N.addNotificationResponseReceivedListener.mockReturnValue({ remove } as any);
    const onRoute = jest.fn();
    const unsubscribe = subscribeToNotificationTaps(onRoute);
    const listener = N.addNotificationResponseReceivedListener.mock.calls[0][0];

    listener(response({ url: '/loans' }));
    expect(onRoute).toHaveBeenCalledWith('/loans');

    unsubscribe();
    expect(remove).toHaveBeenCalled();
    listener(response({ url: '/reports' }));
    expect(onRoute).toHaveBeenCalledTimes(1);
  });
});

describe('rebuildNotifications', () => {
  const prefs = {
    morningEnabled: true,
    morningHour: 9,
    morningMinute: 0,
    eveningEnabled: true,
    eveningHour: 20,
    eveningMinute: 0,
    overspendAlerts: true,
    billAlerts: true,
    weeklySummary: false,
    suuCheckins: true,
  };
  const scheduled = (identifier: string) => ({ identifier }) as Notifications.NotificationRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getNotificationPrefs).mockResolvedValue(prefs);
    jest.mocked(getAlertQueue).mockResolvedValue([]);
    jest.mocked(setAlertQueue).mockResolvedValue(undefined);
    jest.mocked(listLoansDue).mockResolvedValue([]);
    jest.mocked(hasLoggedOn).mockResolvedValue(false);
    N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    N.cancelScheduledNotificationAsync.mockResolvedValue(undefined as any);
    N.setNotificationChannelAsync.mockResolvedValue(null as any);
    N.scheduleNotificationAsync.mockResolvedValue('id');
    N.getPermissionsAsync.mockResolvedValue({ granted: true } as any);
  });

  it('schedules the evening nudge on every day ahead, each opening Add on the Yume reminders channel', async () => {
    expect(await rebuildNotifications()).toBe(true);
    const calls = N.scheduleNotificationAsync.mock.calls.map((c) => c[0]);
    expect(calls.length).toBeGreaterThanOrEqual(13);
    for (const call of calls) {
      expect(call.identifier).toMatch(/^yume-\d{4}-\d{2}-\d{2}-evening$/);
      expect(call.content.data).toEqual({ url: '/add-transaction' });
      expect((call.trigger as { channelId?: string }).channelId).toBe('default');
    }
  });

  it('never schedules two notifications at the same moment', async () => {
    jest.mocked(listLoansDue).mockResolvedValue([]);
    await rebuildNotifications();
    const times = N.scheduleNotificationAsync.mock.calls.map((c) =>
      (c[0].trigger as { date: Date }).date.getTime()
    );
    expect(new Set(times).size).toBe(times.length);
  });

  it('replaces only the scheduled notifications Yume owns, old ones included', async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('yume-daily-reminder'),
      scheduled('yume-loan-due-1'),
      scheduled('yume-snooze-yume-emi'),
      scheduled('yume-2020-01-01-evening'),
      scheduled('somebody-elses'),
    ]);
    await rebuildNotifications();
    const cancelled = N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0]).sort();
    expect(cancelled).toEqual([
      'yume-2020-01-01-evening',
      'yume-daily-reminder',
      'yume-loan-due-1',
      'yume-snooze-yume-emi',
    ]);
  });

  it('schedules nothing, and still succeeds, without notification permission', async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false } as any);
    expect(await rebuildNotifications()).toBe(true);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules nothing when both times are off', async () => {
    jest
      .mocked(getNotificationPrefs)
      .mockResolvedValue({ ...prefs, morningEnabled: false, eveningEnabled: false });
    await rebuildNotifications();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reports a failure instead of throwing', async () => {
    const warn = jest.spyOn(console, 'error').mockImplementation(() => {});
    N.scheduleNotificationAsync.mockRejectedValue(new Error('boom'));
    expect(await rebuildNotifications()).toBe(false);
    warn.mockRestore();
  });

  it('reports failed removal rather than claiming stale reminders were replaced', async () => {
    const warn = jest.spyOn(console, 'error').mockImplementation(() => {});
    N.getAllScheduledNotificationsAsync.mockResolvedValue([scheduled('yume-old')]);
    N.cancelScheduledNotificationAsync.mockRejectedValue(new Error('OS cancellation failed'));
    expect(await rebuildNotifications()).toBe(false);
    expect(N.scheduleNotificationAsync).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('runs one rebuild at a time', async () => {
    const order: string[] = [];
    N.getAllScheduledNotificationsAsync.mockImplementation(async () => {
      order.push('start');
      await new Promise((r) => setTimeout(r, 10));
      order.push('end');
      return [];
    });
    await Promise.all([rebuildNotifications(), rebuildNotifications()]);
    expect(order).toEqual(['start', 'end', 'start', 'end']);
  });
});

describe('notification delivery checks', () => {
  const originalOS = Object.getOwnPropertyDescriptor(Platform, 'OS');
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    N.setNotificationChannelAsync.mockResolvedValue(null as any);
    N.getPermissionsAsync.mockResolvedValue({ granted: true } as any);
    N.getNotificationChannelAsync.mockResolvedValue({
      importance: Notifications.AndroidImportance.DEFAULT,
    } as any);
    N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    N.scheduleNotificationAsync.mockResolvedValue('test');
  });
  afterEach(() => {
    if (originalOS) Object.defineProperty(Platform, 'OS', originalOS);
  });
  it('creates the Android channel before asking for notification permission', async () => {
    await requestNotificationPermission();
    expect(N.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      N.getPermissionsAsync.mock.invocationCallOrder[0]
    );
  });
  it('distinguishes an enabled app permission from a blocked reminder category', async () => {
    N.getNotificationChannelAsync.mockResolvedValue({
      importance: Notifications.AndroidImportance.NONE,
    } as any);
    expect(await getNotificationDeliveryStatus()).toEqual({
      permitted: true,
      channelBlocked: true,
      scheduledCount: 0,
    });
    await expect(sendTestNotification()).rejects.toThrow('Yume reminders category');
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
  it('counts actual dated reminder requests without counting unrelated or test notifications', async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue(
      ['yume-2026-10-13-evening', 'yume-2026-10-14-morning', 'yume-delivery-test', 'other'].map(
        (identifier) => ({ identifier })
      ) as any
    );
    expect((await getNotificationDeliveryStatus()).scheduledCount).toBe(2);
  });
  it('sends a test immediately through the real reminder channel without personal amounts', async () => {
    await sendTestNotification();
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'yume-delivery-test',
        trigger: { channelId: 'default' },
        content: expect.objectContaining({ title: 'Yume notification test' }),
      })
    );
  });
  it('does not report a test as sent when permission is denied', async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false } as any);
    N.requestPermissionsAsync.mockResolvedValue({ granted: false } as any);
    await expect(sendTestNotification()).rejects.toThrow('Allow Yume notifications');
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
