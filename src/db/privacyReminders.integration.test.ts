import { createRealDataTestDb } from '@/test-support/realDataTestDb';
let mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));

import * as Notifications from 'expo-notifications';
import { CREATE_TABLES_SQL } from './schema';
import { archiveAccount, createAccount } from './accounts';
import {
  archiveCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  restoreCategory,
  unarchiveCategory,
} from './categories';
import { createRecurringRule, listRecurringRules } from './recurring';
import { createBudget } from './budgets';
import {
  createPerson,
  recordMoneyReceivedFromPerson,
  getPersonLedger,
  deleteLedgerEntry,
  restoreLedgerEntry,
  undoPersonTransaction,
  addLedgerEntry,
} from './people';
import { rebuildNotifications } from '@/lib/notifications';
import { hasLoggedOn } from './notificationData';
import { createTransaction } from './transactions';
import { expectRefund, receiveRefund } from './refundTracking';
import {
  getHideSensitiveAmounts,
  getAlertQueue,
  addQueuedAlerts,
  setAlertQueue,
  getNotificationPrefs,
  resetSettingsCache,
  setNotificationPrefs,
} from './settings';
import { saveHideSensitiveAmounts } from './afterCommit';

const N = jest.mocked(Notifications);
const scheduled = new Map<string, Notifications.NotificationContentInput>();
const scheduledText = () => [...scheduled.values()].map((content) => content.body ?? '').join('\n');
const allScheduledText = () => [...scheduled.values()].map((c) => `${c.title}\n${c.body}`).join('\n');
const todaysEveningText = () => scheduled.get('yume-2026-10-19-evening')?.body ?? '';
let categoryId: string;
let accountId: string;
let purchaseId: string;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 19, 7));
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  scheduled.clear();
  N.getAllScheduledNotificationsAsync.mockImplementation(
    async () =>
      [...scheduled].map(([identifier, content]) => ({
        identifier,
        content,
      })) as Notifications.NotificationRequest[]
  );
  N.scheduleNotificationAsync.mockImplementation(async (request) => {
    scheduled.set(request.identifier!, request.content);
    return request.identifier!;
  });
  N.cancelScheduledNotificationAsync.mockImplementation(async (identifier) => {
    scheduled.delete(identifier);
  });
  N.getPermissionsAsync.mockResolvedValue({ granted: true } as Notifications.NotificationPermissionsStatus);
  N.getNotificationChannelAsync.mockResolvedValue(null);
  N.setNotificationChannelAsync.mockResolvedValue(null);
  await setNotificationPrefs({
    ...(await getNotificationPrefs()),
    recurringAlerts: true,
    refundAlerts: true,
  });
  accountId = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1000000 })
  ).id;
  categoryId = (await createCategory({ name: 'Private category', kind: 'expense', isSensitive: true })).id;
  await createRecurringRule({
    type: 'expense',
    accountId,
    categoryId,
    note: 'Private bill',
    amountMinor: 10000,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: '2026-10-20',
  });
  purchaseId = (
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId,
      note: 'Private purchase',
      amountMinor: 10000,
      date: '2026-10-17',
    })
  ).id;
  await expectRefund(purchaseId, 10000, '2026-10-19');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('replaces already-queued private bill/refund payloads when privacy is enabled and restores them on reveal', async () => {
  expect(scheduledText()).toContain('Private bill');
  expect(scheduledText()).toContain('Private purchase');
  expect(await saveHideSensitiveAmounts(true)).toBe(true);
  expect(await getHideSensitiveAmounts()).toBe(true);
  expect(scheduledText()).not.toContain('Private bill');
  expect(scheduledText()).not.toContain('Private purchase');
  expect(await saveHideSensitiveAmounts(false)).toBe(true);
  expect(scheduledText()).toContain('Private bill');
  expect(scheduledText()).toContain('Private purchase');
});

it('refreshes queued content after sensitivity and parent changes commit', async () => {
  await updateCategory(categoryId, {
    name: 'Private category',
    icon: 'tag',
    color: '#123456',
    isSensitive: false,
  });
  await saveHideSensitiveAmounts(true);
  expect(scheduledText()).toContain('Private bill');
  expect(
    await updateCategory(categoryId, {
      name: 'Private category',
      icon: 'tag',
      color: '#123456',
      isSensitive: true,
    })
  ).toBe(true);
  expect(scheduledText()).not.toContain('Private bill');
  await updateCategory(categoryId, {
    name: 'Private category',
    icon: 'tag',
    color: '#123456',
    isSensitive: false,
  });
  const parent = await createCategory({ name: 'Sensitive parent', kind: 'expense', isSensitive: true });
  expect(
    await updateCategory(categoryId, {
      name: 'Private category',
      icon: 'tag',
      color: '#123456',
      parentId: parent.id,
    })
  ).toBe(true);
  expect(scheduledText()).not.toContain('Private bill');
  expect(scheduledText()).not.toContain('Private purchase');
});

it('reports scheduler failure while preserving committed privacy/category changes', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  N.scheduleNotificationAsync.mockRejectedValue(new Error('OS scheduler unavailable'));
  expect(await saveHideSensitiveAmounts(true)).toBe(false);
  expect(await getHideSensitiveAmounts()).toBe(true);
  expect(scheduledText()).not.toContain('Private bill');
  expect(scheduledText()).not.toContain('Private purchase');
  expect(
    await updateCategory(categoryId, {
      name: 'Private category',
      icon: 'tag',
      color: '#123456',
      isSensitive: false,
    })
  ).toBe(false);
  expect(
    await mockDb.getFirstAsync('SELECT is_sensitive FROM categories WHERE id = ?', [categoryId])
  ).toEqual({ is_sensitive: 0 });
});

it('cancels private OS payloads even when phone permission was revoked before hiding amounts', async () => {
  expect(scheduledText()).toContain('Private purchase');
  N.getPermissionsAsync.mockResolvedValue({ granted: false } as Notifications.NotificationPermissionsStatus);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(await saveHideSensitiveAmounts(true)).toBe(false);
  expect(scheduledText()).not.toContain('Private bill');
  expect(scheduledText()).not.toContain('Private purchase');
});

it('clears stale private payloads even when attention topics have since been disabled', async () => {
  expect(scheduledText()).toContain('Private purchase');
  await setNotificationPrefs({
    ...(await getNotificationPrefs()),
    recurringAlerts: false,
    refundAlerts: false,
  });
  expect(await saveHideSensitiveAmounts(true)).toBe(true);
  expect(scheduledText()).not.toContain('Private bill');
  expect(scheduledText()).not.toContain('Private purchase');
});

it('refreshes existing family payloads when a sensitive child is added, deleted or restored by Undo', async () => {
  await updateCategory(categoryId, {
    name: 'Private category',
    icon: 'tag',
    color: '#123456',
    isSensitive: false,
  });
  await saveHideSensitiveAmounts(true);
  expect(scheduledText()).toContain('Private bill');
  const child = await createCategory({
    name: 'Private child',
    kind: 'expense',
    parentId: categoryId,
    isSensitive: true,
  });
  expect(scheduledText()).not.toContain('Private bill');
  expect(scheduledText()).not.toContain('Private purchase');
  const snapshot = await deleteCategory(child.id);
  expect(scheduledText()).toContain('Private bill');
  await restoreCategory(snapshot);
  expect(scheduledText()).not.toContain('Private bill');
  expect(scheduledText()).not.toContain('Private purchase');
});

it('keeps category creation successful and reports a failed family refresh through its warning callback', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  N.scheduleNotificationAsync.mockRejectedValue(new Error('OS unavailable'));
  const warning = jest.fn();
  const child = await createCategory(
    { name: 'Private child', kind: 'expense', parentId: categoryId, isSensitive: true },
    warning
  );
  expect(warning).toHaveBeenCalledTimes(1);
  expect(await mockDb.getFirstAsync('SELECT is_sensitive FROM categories WHERE id = ?', [child.id])).toEqual({
    is_sensitive: 1,
  });
});

it.each(['2026-10-18', '2026-10-19'])(
  'removes refund follow-ups after a full receipt dated %s with one rebuild',
  async (date) => {
    expect(scheduledText()).toContain('Private purchase');
    N.getAllScheduledNotificationsAsync.mockClear();
    await receiveRefund(purchaseId, { accountId, date, amountMinor: 10000 });
    expect(scheduledText()).not.toContain('Private purchase');
    expect(scheduledText()).toContain('Private bill');
    expect(N.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  }
);

it('keeps follow-ups for a partial backdated refund and does not rebuild a rejected receipt', async () => {
  await receiveRefund(purchaseId, { accountId, date: '2026-10-18', amountMinor: 4000 });
  expect(scheduledText()).toContain('Private purchase');
  N.getAllScheduledNotificationsAsync.mockClear();
  await expect(
    receiveRefund(purchaseId, { accountId, date: '2026-10-18', amountMinor: 6001 })
  ).rejects.toThrow('remaining');
  expect(N.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(scheduledText()).toContain('Private purchase');
});

it('removes queued sensitive budget copy on hide while retaining public alerts', async () => {
  await setNotificationPrefs({ ...(await getNotificationPrefs()), overspendAlerts: true });
  for (const [name, sensitive] of [
    ['Queued medical', true],
    ['Public groceries', false],
  ] as const) {
    const cat = await createCategory({ name, kind: 'expense', isSensitive: sensitive });
    await createBudget({
      categoryId: cat.id,
      limitAmountMinor: 10000,
      periodMonth: '2026-10',
      rollover: false,
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: cat.id,
      amountMinor: 12000,
      date: '2026-10-19',
    });
  }
  expect(allScheduledText()).toContain('Queued medical');
  expect(allScheduledText()).toContain('₹120');
  expect(await saveHideSensitiveAmounts(true)).toBe(true);
  expect(allScheduledText()).not.toContain('Queued medical');
  expect(allScheduledText()).toContain('Public groceries');
  expect((await getAlertQueue()).some((a) => a.title.includes('Queued medical'))).toBe(false);
});

it('regenerates budget amounts and labels from live data before applying family privacy changes', async () => {
  await setNotificationPrefs({ ...(await getNotificationPrefs()), overspendAlerts: true });
  const parent = await createCategory({ name: 'Public budget', kind: 'expense' });
  await createBudget({
    categoryId: parent.id,
    limitAmountMinor: 10000,
    periodMonth: '2026-10',
    rollover: false,
  });
  await createTransaction({
    type: 'expense',
    accountId,
    categoryId: parent.id,
    amountMinor: 12000,
    date: '2026-10-19',
  });
  await updateCategory(parent.id, { name: 'Renamed budget', icon: 'tag', color: '#123456' });
  await createTransaction({
    type: 'expense',
    accountId,
    categoryId: parent.id,
    amountMinor: 2000,
    date: '2026-10-19',
  });
  expect(allScheduledText()).toContain('Renamed budget');
  expect(allScheduledText()).toContain('₹140');
  expect(allScheduledText()).not.toContain('Public budget');
  await saveHideSensitiveAmounts(true);
  await createCategory({
    name: 'Sensitive sibling',
    kind: 'expense',
    parentId: parent.id,
    isSensitive: true,
  });
  expect(allScheduledText()).not.toContain('Renamed budget');
  expect((await getAlertQueue()).some((a) => a.title.includes('budget'))).toBe(false);
});

it('drops legacy queued copy without privacy provenance when hiding', async () => {
  await setNotificationPrefs({ ...(await getNotificationPrefs()), overspendAlerts: true });
  await addQueuedAlerts([
    {
      id: 'old',
      queuedAt: new Date().toISOString(),
      title: 'Old private label',
      body: '₹123 private',
      extra: 'Old private label: ₹123 private',
      route: '/budgets',
    },
  ]);
  await rebuildNotifications();
  expect(allScheduledText()).toContain('Old private label');
  expect(await saveHideSensitiveAmounts(true)).toBe(true);
  expect(allScheduledText()).not.toContain('Old private label');
  expect(await getAlertQueue()).toEqual([]);
});

it('removes queued spending-spike copy when its category becomes sensitive', async () => {
  await setNotificationPrefs({ ...(await getNotificationPrefs()), overspendAlerts: true });
  const cat = await createCategory({ name: 'Spiking spend', kind: 'expense' });
  await createTransaction({
    type: 'expense',
    accountId,
    categoryId: cat.id,
    amountMinor: 10000,
    date: '2026-09-10',
  });
  await createTransaction({
    type: 'expense',
    accountId,
    categoryId: cat.id,
    amountMinor: 50000,
    date: '2026-10-10',
  });
  expect((await getAlertQueue()).some((a) => a.source?.kind === 'spike')).toBe(true);
  expect(allScheduledText()).toContain('Spiking spend');
  await saveHideSensitiveAmounts(true);
  await updateCategory(cat.id, { name: cat.name, icon: cat.icon, color: cat.color, isSensitive: true });
  expect(allScheduledText()).not.toContain('Spiking spend');
});

it('cancels bill reminders on account archive after pausing its rules, with exactly one rebuild', async () => {
  expect(scheduledText()).toContain('Private bill');
  N.getAllScheduledNotificationsAsync.mockClear();
  await archiveAccount(accountId);
  expect((await listRecurringRules()).every((r) => !r.active)).toBe(true);
  expect(scheduledText()).not.toContain('Private bill');
  expect(N.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
});

it('refreshes bill eligibility when a category is archived and restored, without pausing the rule', async () => {
  await archiveCategory(categoryId);
  expect(scheduledText()).not.toContain('Private bill');
  expect((await listRecurringRules())[0].active).toBe(true);
  await unarchiveCategory(categoryId);
  expect(scheduledText()).toContain('Private bill');
});

it('refreshes logging reminders after person receipts, deletion, restoration and Undo', async () => {
  await setNotificationPrefs({ ...(await getNotificationPrefs()), eveningEnabled: true });
  await rebuildNotifications();
  const person = await createPerson({ name: 'Friend' });
  const income = await createCategory({ name: 'Person receipts', kind: 'income' });
  expect(await hasLoggedOn('2026-10-19')).toBe(false);
  expect(todaysEveningText()).toContain('Add today’s spending');
  N.getAllScheduledNotificationsAsync.mockClear();
  await recordMoneyReceivedFromPerson({
    personId: person.id,
    accountId,
    categoryId: income.id,
    amountMinor: 5000,
    date: '2026-10-19',
  });
  expect(await hasLoggedOn('2026-10-19')).toBe(true);
  expect(todaysEveningText()).not.toContain('Add today’s spending');
  expect(N.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  const [entry] = await getPersonLedger(person.id);
  const snapshots = await deleteLedgerEntry(entry.id);
  expect(todaysEveningText()).toContain('Add today’s spending');
  await restoreLedgerEntry(snapshots);
  expect(todaysEveningText()).not.toContain('Add today’s spending');
  await undoPersonTransaction(entry.transactionId!);
  expect(todaysEveningText()).toContain('Add today’s spending');
});

it('does not refresh for rejected person receipts or balance-only adjustments', async () => {
  const person = await createPerson({ name: 'Friend' });
  N.getAllScheduledNotificationsAsync.mockClear();
  await expect(
    recordMoneyReceivedFromPerson({
      personId: person.id,
      accountId,
      categoryId,
      amountMinor: -100,
      date: '2026-10-19',
    })
  ).rejects.toThrow();
  const entry = await addLedgerEntry({ personId: person.id, amountMinor: 100, date: '2026-10-19' });
  const snapshots = await deleteLedgerEntry(entry.id);
  await restoreLedgerEntry(snapshots);
  expect(N.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
});

it('keeps an account archive and a person receipt committed when scheduling fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  N.scheduleNotificationAsync.mockRejectedValue(new Error('OS unavailable'));
  await archiveAccount(accountId);
  expect((await listRecurringRules())[0].active).toBe(false);
  // Use another live account: the archived account is intentionally unavailable for new cash movements.
  const live = await createAccount({ name: 'Live', type: 'bank', currency: 'INR', openingBalanceMinor: 0 });
  const person = await createPerson({ name: 'Friend' });
  const income = await createCategory({ name: 'Person receipts', kind: 'income' });
  await recordMoneyReceivedFromPerson({
    personId: person.id,
    accountId: live.id,
    categoryId: income.id,
    amountMinor: 5000,
    date: '2026-10-19',
  });
  expect(await hasLoggedOn('2026-10-19')).toBe(true);
  expect(await getPersonLedger(person.id)).toHaveLength(1);
});

it('preserves an alert queued during a rebuild while removing stale snapshot entries', async () => {
  await setNotificationPrefs({ ...(await getNotificationPrefs()), overspendAlerts: true });
  const old = {
    id: 'expired',
    queuedAt: '2026-10-01T00:00:00.000Z',
    title: 'Expired',
    body: 'Expired',
    extra: 'Expired',
    route: '/budgets' as const,
  };
  const newer = {
    ...old,
    id: 'new',
    queuedAt: new Date().toISOString(),
    title: 'New alert',
    body: 'New alert',
    extra: 'New alert',
  };
  await setAlertQueue([old]);
  N.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
    await addQueuedAlerts([newer]);
    scheduled.set(request.identifier!, request.content);
    return request.identifier!;
  });
  expect(await rebuildNotifications()).toBe(true);
  expect(await getAlertQueue()).toEqual([newer]);
  await rebuildNotifications();
  expect(allScheduledText()).toContain('New alert');
});
