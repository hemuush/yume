import { rebuildAttentionNotificationsAfterCommit } from './afterCommit';
import { getNotificationPrefs } from './settings';
import { rebuildNotifications } from '@/lib/notifications';
jest.mock('./settings', () => ({ getNotificationPrefs: jest.fn() }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: jest.fn() }));
afterEach(() => jest.resetAllMocks());
it('refreshes only enabled topics after their writes have committed', async () => {
  jest.mocked(getNotificationPrefs).mockResolvedValue({ recurringAlerts: true, refundAlerts: false } as any);
  jest.mocked(rebuildNotifications).mockResolvedValue(true);
  await rebuildAttentionNotificationsAfterCommit('refundAlerts');
  expect(rebuildNotifications).not.toHaveBeenCalled();
  await rebuildAttentionNotificationsAfterCommit('recurringAlerts');
  expect(rebuildNotifications).toHaveBeenCalledTimes(1);
});
it('contains scheduler failures so a successful financial action is not reported as failed', async () => {
  jest.mocked(getNotificationPrefs).mockResolvedValue({ refundAlerts: true } as any);
  jest.mocked(rebuildNotifications).mockRejectedValue(new Error('OS unavailable'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(rebuildAttentionNotificationsAfterCommit('refundAlerts')).resolves.toBeUndefined();
  warn.mockRestore();
});
it('logs a rejected schedule without invalidating the committed action', async () => {
  jest.mocked(getNotificationPrefs).mockResolvedValue({ refundAlerts: true } as any);
  jest.mocked(rebuildNotifications).mockResolvedValue(false);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(rebuildAttentionNotificationsAfterCommit('refundAlerts')).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
