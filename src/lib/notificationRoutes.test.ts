/**
 * Notification taps: each Yume notification carries the screen it should
 * open, only routes on the fixed list are ever honoured, and the response
 * that cold-started the app is cleared once read so it can't reopen that
 * screen on every later launch.
 */
import * as Notifications from 'expo-notifications';
import {
  notificationRoute,
  notifyOverspend,
  subscribeToNotificationTaps,
  syncDailyReminder,
  NOTIFICATION_ROUTES,
} from './notifications';

jest.mock('@/db/settings', () => ({ getNotificationPrefs: jest.fn() }));

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

describe('scheduled notifications carry their route', () => {
  it('the daily reminder opens Add', async () => {
    N.cancelScheduledNotificationAsync.mockResolvedValue(undefined as any);
    N.setNotificationChannelAsync.mockResolvedValue(null as any);
    N.scheduleNotificationAsync.mockResolvedValue('id');
    await syncDailyReminder({ reminderEnabled: true, reminderHour: 21, reminderMinute: 0 } as any);
    const content = N.scheduleNotificationAsync.mock.calls[0][0].content;
    expect(content.data).toEqual({ url: '/add-transaction' });
    expect(typeof content.title).toBe('string');
  });

  it('every notification is posted to the Yume reminders channel', async () => {
    N.cancelScheduledNotificationAsync.mockResolvedValue(undefined as any);
    N.setNotificationChannelAsync.mockResolvedValue(null as any);
    N.scheduleNotificationAsync.mockResolvedValue('id');
    N.getPermissionsAsync.mockResolvedValue({ granted: true } as any);
    await syncDailyReminder({ reminderEnabled: true, reminderHour: 21, reminderMinute: 0 } as any);
    await notifyOverspend('Food', 0.5);
    for (const call of N.scheduleNotificationAsync.mock.calls) {
      expect((call[0].trigger as { channelId?: string } | null)?.channelId).toBe('default');
    }
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });
});
