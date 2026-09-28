/**
 * Notification buttons: what "Type it in" reads from a reply, where each
 * button opens, when a snooze brings the notification back, and what the
 * quiet buttons change.
 */
import * as Notifications from 'expo-notifications';
import {
  parseQuickReply,
  responseRoute,
  snoozeUntil,
  runQuietAction,
  isQuietAction,
  registerNotificationCategories,
  NOTIFICATION_KIND,
} from './notificationActions';
import { addBudgetNudgesSent } from '@/db/settings';

jest.mock('@/db/settings', () => ({ addBudgetNudgesSent: jest.fn() }));

const N = Notifications as jest.Mocked<typeof Notifications>;

function response(
  actionIdentifier: string,
  data: Record<string, unknown> = {},
  extra: { userText?: string; categoryIdentifier?: string } = {}
) {
  return {
    actionIdentifier,
    userText: extra.userText,
    notification: {
      request: {
        identifier: 'n1',
        content: { title: 'T', body: 'B', data, categoryIdentifier: extra.categoryIdentifier ?? null },
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

describe('parseQuickReply', () => {
  it('splits an amount and a note', () => {
    expect(parseQuickReply('250 lunch')).toEqual({ amountMinor: 25000, note: 'lunch' });
    expect(parseQuickReply('₹1,200 rent')).toEqual({ amountMinor: 120000, note: 'rent' });
    expect(parseQuickReply('coffee 80.50')).toEqual({ amountMinor: 8050, note: 'coffee' });
    expect(parseQuickReply('Rs. 40 for chai')).toEqual({ amountMinor: 4000, note: 'chai' });
  });

  it('keeps what it can when a part is missing', () => {
    expect(parseQuickReply('lunch')).toEqual({ amountMinor: null, note: 'lunch' });
    expect(parseQuickReply('500')).toEqual({ amountMinor: 50000, note: '' });
    expect(parseQuickReply('')).toEqual({ amountMinor: null, note: '' });
    expect(parseQuickReply(undefined)).toEqual({ amountMinor: null, note: '' });
    expect(parseQuickReply('0 nothing')).toEqual({ amountMinor: null, note: '0 nothing' });
  });

  it('caps a long note', () => {
    expect(parseQuickReply(`10 ${'a'.repeat(200)}`).note).toHaveLength(80);
  });
});

describe('responseRoute', () => {
  it('a plain tap and open buttons go where the notification points', () => {
    const tap = Notifications.DEFAULT_ACTION_IDENTIFIER ?? 'expo.modules.notifications.actions.DEFAULT';
    expect(responseRoute(response(tap, { url: '/budgets' }))).toBe('/budgets');
    expect(responseRoute(response('add', { url: '/add-transaction' }))).toBe('/add-transaction');
    expect(responseRoute(response('play', { url: '/wrap?period=week' }))).toBe('/wrap?period=week');
    expect(responseRoute(response('see', { url: '/backup' }))).toBeNull();
  });

  it('"Type it in" opens Add with the amount and note', () => {
    expect(responseRoute(response('type', {}, { userText: '250 Lunch & tea' }))).toBe(
      '/add-transaction?amount=25000&note=Lunch%20%26%20tea'
    );
    expect(responseRoute(response('type', {}, { userText: '' }))).toBe('/add-transaction');
  });

  it('"Pay now" opens that loan, and ignores a malformed id', () => {
    expect(responseRoute(response('pay', { loanId: 'abc-123' }))).toBe('/loans?pay=abc-123');
    expect(responseRoute(response('pay', { loanId: '../x?y' }))).toBe('/loans');
    expect(responseRoute(response('pay', {}))).toBe('/loans');
  });

  it('quiet buttons open nothing', () => {
    for (const id of ['later', 'tomorrow', 'tonight', 'quiet', 'got-it']) {
      expect(isQuietAction(id)).toBe(true);
      expect(responseRoute(response(id, { url: '/budgets' }))).toBeNull();
    }
    expect(responseRoute(null)).toBeNull();
  });
});

describe('snoozeUntil', () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 28, h, m);

  it('"In 1 hour" is an hour from now', () => {
    expect(snoozeUntil('later', at(21, 30))).toEqual(at(22, 30));
  });

  it('"Tomorrow" is 9 AM the next day', () => {
    expect(snoozeUntil('tomorrow', at(9, 5))).toEqual(new Date(2026, 8, 29, 9, 0));
  });

  it('"Tonight" is 8 PM, or an hour away when 8 PM is too close or past', () => {
    expect(snoozeUntil('tonight', at(14))).toEqual(at(20));
    expect(snoozeUntil('tonight', at(19, 45))).toEqual(at(20, 45));
    expect(snoozeUntil('tonight', at(21, 30))).toEqual(at(22, 30));
  });
});

describe('runQuietAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    N.dismissNotificationAsync.mockResolvedValue(undefined as any);
    N.scheduleNotificationAsync.mockResolvedValue('id');
  });

  it('a snooze clears the notification and brings the same one back', async () => {
    await runQuietAction(
      response('later', { url: '/add-transaction' }, { categoryIdentifier: NOTIFICATION_KIND.daily })
    );
    expect(N.dismissNotificationAsync).toHaveBeenCalledWith('n1');
    const req = N.scheduleNotificationAsync.mock.calls[0][0];
    expect(req.identifier).toBe('yume-snooze-yume-daily');
    expect(req.content).toEqual({
      title: 'T',
      body: 'B',
      data: { url: '/add-transaction' },
      categoryIdentifier: NOTIFICATION_KIND.daily,
    });
  });

  it('"Quiet this month" marks both of the budget\'s nudges as sent', async () => {
    await runQuietAction(response('quiet', { budgetKey: 'b1:2026-09' }));
    expect(addBudgetNudgesSent).toHaveBeenCalledWith(['b1:2026-09:near', 'b1:2026-09:over']);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('"Got it" only clears it', async () => {
    await runQuietAction(response('got-it'));
    expect(N.dismissNotificationAsync).toHaveBeenCalledWith('n1');
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(addBudgetNudgesSent).not.toHaveBeenCalled();
  });
});

describe('registerNotificationCategories', () => {
  it('registers every kind with its buttons', async () => {
    N.setNotificationCategoryAsync.mockResolvedValue(null as any);
    await registerNotificationCategories();
    const ids = N.setNotificationCategoryAsync.mock.calls.map((c) => c[0]);
    expect(ids.sort()).toEqual(Object.values(NOTIFICATION_KIND).sort());
    const daily = N.setNotificationCategoryAsync.mock.calls.find((c) => c[0] === NOTIFICATION_KIND.daily)!;
    expect(daily[1].map((a) => a.buttonTitle)).toEqual(['Add expense', 'Type it in', 'In 1 hour']);
  });
});
