/**
 * Asking for notification permission once. Android 13 and later grant nothing until an app asks, and the
 * morning reminder is on from the start, so the first time the app is showing it asks; never twice.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { askNotificationPermissionOnce } from './notifications';
import {
  getNotificationPermissionAsked,
  getNotificationPrefs,
  setNotificationPermissionAsked,
  getAlertQueue,
} from '@/db/settings';
import { hasLoggedOn, listLoansDue, listReminderAttention } from '@/db/notificationData';

jest.mock('@/db/settings', () => ({
  getHideSensitiveAmounts: jest.fn(async () => false),
  getNotificationPrefs: jest.fn(),
  getAlertQueue: jest.fn(),
  getScheduledReminders: jest.fn(async () => []),
  setScheduledReminders: jest.fn(),
  setAlertQueue: jest.fn(),
  getNotificationPermissionAsked: jest.fn(),
  setNotificationPermissionAsked: jest.fn(),
}));
jest.mock('@/db/notificationData', () => ({
  listLoansDue: jest.fn(),
  hasLoggedOn: jest.fn(),
  listReminderAttention: jest.fn(),
}));

const N = Notifications as jest.Mocked<typeof Notifications>;
const prefs = (over: object = {}) => ({
  morningEnabled: true,
  morningHour: 8,
  morningMinute: 0,
  eveningEnabled: false,
  eveningHour: 20,
  eveningMinute: 0,
  overspendAlerts: false,
  billAlerts: false,
  weeklySummary: false,
  ...over,
});
const permission = (over: object) => ({ granted: false, canAskAgain: true, status: 'undetermined', ...over });

beforeEach(() => {
  jest.resetAllMocks();
  Platform.OS = 'android';
  (getNotificationPrefs as jest.Mock).mockResolvedValue(prefs());
  (getNotificationPermissionAsked as jest.Mock).mockResolvedValue(false);
  (getAlertQueue as jest.Mock).mockResolvedValue([]);
  jest.mocked(require('@/db/settings').getScheduledReminders).mockResolvedValue([]);
  (listLoansDue as jest.Mock).mockResolvedValue([]);
  (hasLoggedOn as jest.Mock).mockResolvedValue(false);
  (listReminderAttention as jest.Mock).mockResolvedValue([]);
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.getNotificationChannelAsync.mockResolvedValue({ importance: 3 } as never);
  N.setNotificationChannelAsync.mockResolvedValue(null as never);
});

it('asks once on a phone that has not been asked, remembers it, and schedules once allowed', async () => {
  N.getPermissionsAsync
    .mockResolvedValueOnce(permission({}) as never) // the check up front
    .mockResolvedValueOnce(permission({}) as never) // inside the request
    .mockResolvedValue(permission({ granted: true, status: 'granted' }) as never); // after
  N.requestPermissionsAsync.mockResolvedValue(permission({ granted: true, status: 'granted' }) as never);
  expect(await askNotificationPermissionOnce()).toBe(true);
  expect(setNotificationPermissionAsked).toHaveBeenCalledTimes(1);
  expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(N.scheduleNotificationAsync).toHaveBeenCalled();
});

it('does not ask again once it has asked', async () => {
  (getNotificationPermissionAsked as jest.Mock).mockResolvedValue(true);
  N.getPermissionsAsync.mockResolvedValue(permission({}) as never);
  expect(await askNotificationPermissionOnce()).toBe(false);
  expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('does nothing when permission is already granted', async () => {
  N.getPermissionsAsync.mockResolvedValue(permission({ granted: true, status: 'granted' }) as never);
  expect(await askNotificationPermissionOnce()).toBe(true);
  expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(setNotificationPermissionAsked).not.toHaveBeenCalled();
});

it('does not ask when the phone will not show the prompt again', async () => {
  N.getPermissionsAsync.mockResolvedValue(permission({ canAskAgain: false, status: 'denied' }) as never);
  expect(await askNotificationPermissionOnce()).toBe(false);
  expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('does not ask when both reminder times are off', async () => {
  (getNotificationPrefs as jest.Mock).mockResolvedValue(prefs({ morningEnabled: false }));
  N.getPermissionsAsync.mockResolvedValue(permission({}) as never);
  expect(await askNotificationPermissionOnce()).toBe(false);
  expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('schedules nothing when the person says no, but does not ask again either', async () => {
  N.getPermissionsAsync.mockResolvedValue(permission({}) as never);
  N.requestPermissionsAsync.mockResolvedValue(permission({ status: 'denied', canAskAgain: false }) as never);
  expect(await askNotificationPermissionOnce()).toBe(false);
  expect(setNotificationPermissionAsked).toHaveBeenCalledTimes(1);
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('does not ask off Android', async () => {
  Platform.OS = 'ios';
  expect(await askNotificationPermissionOnce()).toBe(false);
  expect(N.getPermissionsAsync).not.toHaveBeenCalled();
});

it('can retry a failed native channel setup without marking the phone as already asked', async () => {
  N.getPermissionsAsync.mockResolvedValue(permission({}) as never);
  N.setNotificationChannelAsync.mockRejectedValueOnce(new Error('Native setup failed'));
  await expect(askNotificationPermissionOnce()).rejects.toThrow('Native setup failed');
  expect(setNotificationPermissionAsked).not.toHaveBeenCalled();
  N.requestPermissionsAsync.mockResolvedValue(permission({ status: 'denied' }) as never);
  expect(await askNotificationPermissionOnce()).toBe(false);
  expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(setNotificationPermissionAsked).toHaveBeenCalledTimes(1);
});

it('shares one native prompt between overlapping startup and manual permission requests', async () => {
  const { requestNotificationPermission } = require('./notifications');
  N.getPermissionsAsync.mockResolvedValue(permission({}) as never);
  N.requestPermissionsAsync.mockResolvedValue(permission({ status: 'denied' }) as never);
  await Promise.all([
    askNotificationPermissionOnce(),
    requestNotificationPermission(),
    requestNotificationPermission(),
  ]);
  expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});
