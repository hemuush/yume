/**
 * The notification plan: at most one notification per time; several things due at a time merge into one;
 * and every rule (EMIs, Monday wrap, evening nudge, waiting spending alerts) lands at the right time.
 */
import { PLAN_DAYS, PlanLoan, PlanPrefs, QueuedAlert, planNotifications } from './notificationPlan';

jest.mock('./money', () => ({ formatMoney: (minor: number) => `₹${(minor / 100).toLocaleString('en-IN')}` }));

const prefs: PlanPrefs = {
  morningEnabled: true,
  morningHour: 9,
  morningMinute: 0,
  eveningEnabled: true,
  eveningHour: 20,
  eveningMinute: 0,
  overspendAlerts: true,
  billAlerts: true,
  weeklySummary: false,
};

// Saturday 3 October 2026, 7:00 AM: before the Morning time.
const now = new Date(2026, 9, 3, 7, 0);

const plan = (over: Partial<Parameters<typeof planNotifications>[0]> = {}) =>
  planNotifications({ prefs, loans: [], alerts: [], loggedToday: false, now, ...over });

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const find = (notifications: ReturnType<typeof plan>['notifications'], when: Date) =>
  notifications.find((n) => n.at.getTime() === when.getTime());
const loan = (over: Partial<PlanLoan> = {}): PlanLoan => ({
  id: 'l1',
  counterparty: 'Test Person Bank',
  dueDate: '2026-10-05',
  emiMinor: 1250000,
  ...over,
});
const alert = (over: Partial<QueuedAlert> = {}): QueuedAlert => ({
  id: 'budget:b1:2026-10:over',
  queuedAt: new Date(2026, 9, 3, 12, 0).toISOString(),
  title: 'Food is over budget',
  body: '₹1,050 of ₹1,000 this month.',
  extra: 'Food is over budget (₹1,050 of ₹1,000)',
  route: '/budgets',
  ...over,
});

describe('planNotifications', () => {
  it('merges optional bill and refund reminders into one morning slot', () => {
    const { notifications } = plan({
      prefs: { ...prefs, recurringAlerts: true, refundAlerts: true },
      attention: [
        { id: 'bill', kind: 'bill', label: 'Internet', date: '2026-10-04' },
        { id: 'refund', kind: 'refund', label: 'Shoes', date: '2026-10-03' },
      ],
    });
    const morning = find(notifications, at(3, 9));
    expect(morning?.route).toBe('/recurring');
    expect(morning?.body).toContain('Internet');
    expect(morning?.body).toContain('Shoes');
    expect(notifications.filter((n) => n.at.getTime() === at(3, 9).getTime())).toHaveLength(1);
    expect(find(notifications, at(6, 9))?.title).toBe('Still waiting on your refund?');
  });

  it('keeps optional reminders off unless explicitly enabled, and honours disabled slots', () => {
    const attention = [{ id: 'refund', kind: 'refund' as const, label: 'Shoes', date: '2026-10-03' }];
    expect(find(plan({ attention }).notifications, at(3, 9))?.title).toBe('Your day, at a glance');
    expect(
      plan({
        attention,
        prefs: { ...prefs, refundAlerts: true, morningEnabled: false, eveningEnabled: false },
      }).notifications
    ).toEqual([]);
    expect(
      find(
        plan({ attention, prefs: { ...prefs, refundAlerts: true, morningEnabled: false } }).notifications,
        at(3, 20)
      )?.route
    ).toBe('/(tabs)/plan');
  });
  it('schedules morning-only daily check-ins without bills, alerts or a wrap, even after logging', () => {
    const { notifications } = plan({ prefs: { ...prefs, eveningEnabled: false }, loggedToday: true });
    expect(notifications).toHaveLength(PLAN_DAYS);
    expect(notifications[0]).toMatchObject({
      id: 'yume-2026-10-03-morning',
      title: 'Your day, at a glance',
      route: '/(tabs)/plan',
    });
    expect(notifications[0].at).toEqual(at(3, 9));
    expect(notifications.at(-1)?.id).toBe('yume-2026-10-16-morning');
  });

  it('uses the next morning after the configured time has passed', () => {
    const { notifications } = plan({
      prefs: { ...prefs, eveningEnabled: false, morningHour: 10 },
      now: at(3, 10),
    });
    expect(notifications[0].at).toEqual(at(4, 10));
    expect(notifications.every((n) => n.at > at(3, 10))).toBe(true);
  });
  it('nudges at the Evening time each day for two weeks', () => {
    const notifications = plan().notifications.filter((n) => n.id.endsWith('-evening'));
    expect(notifications).toHaveLength(PLAN_DAYS);
    expect(notifications[0]).toMatchObject({
      id: 'yume-2026-10-03-evening',
      title: 'Before you call it a day',
      body: 'Add today’s spending while it’s fresh in mind.',
      route: '/add-transaction',
    });
    expect(notifications[0].at).toEqual(at(3, 20));
    expect(notifications[PLAN_DAYS - 1].id).toBe('yume-2026-10-16-evening');
  });

  it('never puts two notifications at the same time, whatever is due', () => {
    const { notifications } = plan({
      prefs: { ...prefs, weeklySummary: true },
      loans: [
        loan(),
        loan({ id: 'l2', counterparty: 'Ravi', dueDate: '2026-10-05' }),
        loan({ id: 'l3', dueDate: '2026-10-08' }),
      ],
      alerts: [alert(), alert({ id: 'spike:Food:2026-10' })],
    });
    const times = notifications.map((n) => n.at.getTime());
    expect(new Set(times).size).toBe(times.length);
    expect(new Set(notifications.map((n) => n.id)).size).toBe(notifications.length);
    for (const n of notifications) expect(n.id).toMatch(/^yume-\d{4}-\d{2}-\d{2}-(morning|evening)$/);
  });

  it('keeps the Morning and Evening times apart even at their extremes', () => {
    const { notifications } = plan({
      prefs: { ...prefs, morningHour: 23, morningMinute: 0, eveningHour: 4, eveningMinute: 0 },
    });
    // Out-of-range times are pulled back into their own ranges (11:30 AM and 4:00 PM at the most/least).
    const day = notifications.filter((n) => n.at.getDate() === 4);
    expect(day.map((n) => [n.at.getHours(), n.at.getMinutes()])).toEqual([
      [11, 30],
      [16, 0],
    ]);
  });

  describe('EMIs', () => {
    it('go out on the due day at the Morning time', () => {
      const { notifications } = plan({ loans: [loan()] });
      const emi = find(notifications, at(5, 9));
      expect(emi).toMatchObject({ id: 'yume-2026-10-05-morning', title: 'EMI due today', route: '/loans' });
      expect(emi?.body).toBe('Test Person Bank · ₹12,500\nReview your payment in Loans.');
    });

    it('several due the same day make one notification', () => {
      const { notifications } = plan({
        loans: [loan(), loan({ id: 'l2', counterparty: 'Ravi', emiMinor: 500000 })],
      });
      expect(find(notifications, at(5, 9))).toMatchObject({
        title: '2 EMIs due today',
        body: 'Test Person Bank, Ravi · ₹17,500\nReview your payments in Loans.',
      });
    });

    it('use the Evening time when the Morning is off', () => {
      const { notifications } = plan({ prefs: { ...prefs, morningEnabled: false }, loans: [loan()] });
      expect(find(notifications, at(5, 9))).toBeUndefined();
      expect(find(notifications, at(5, 20))).toMatchObject({ title: 'EMI due today', route: '/loans' });
    });

    it('go out at the next time still ahead when due today', () => {
      const lateNow = new Date(2026, 9, 3, 10, 0);
      const { notifications } = plan({ now: lateNow, loans: [loan({ dueDate: '2026-10-03' })] });
      expect(find(notifications, at(3, 20))).toMatchObject({ title: 'EMI due today' });
    });

    it('are skipped when already overdue, or when bill alerts are off', () => {
      expect(
        plan({ loans: [loan({ dueDate: '2026-10-01' })] }).notifications.map((n) => n.title)
      ).not.toContain('EMI due today');
      expect(
        plan({ prefs: { ...prefs, billAlerts: false }, loans: [loan()] }).notifications.map((n) => n.title)
      ).not.toContain('EMI due today');
    });

    it('once missed, are reminded of each morning until a week after the due day', () => {
      // Due Thursday 1 October; today is Saturday the 3rd.
      const { notifications } = plan({ loans: [loan({ dueDate: '2026-10-01' })] });
      const overdue = notifications.filter((n) => n.title === 'EMI overdue');
      expect(overdue.map((n) => n.at)).toEqual([3, 4, 5, 6, 7, 8].map((d) => at(d, 9)));
      expect(overdue[0].body).toMatch(/^Test Person Bank · ₹12,500 · was due /);
      expect(overdue[0].route).toBe('/loans');
    });

    it('are not reminded of as overdue when bill alerts are off, or long after', () => {
      expect(
        plan({
          prefs: { ...prefs, billAlerts: false },
          loans: [loan({ dueDate: '2026-10-01' })],
        }).notifications.map((n) => n.title)
      ).not.toContain('EMI overdue');
      expect(
        plan({ loans: [loan({ dueDate: '2026-09-01' })] }).notifications.map((n) => n.title)
      ).not.toContain('EMI overdue');
    });

    it('are reminded of even beyond the two-week window', () => {
      const { notifications } = plan({ loans: [loan({ dueDate: '2026-11-20' })] });
      expect(find(notifications, new Date(2026, 10, 20, 9))).toMatchObject({ title: 'EMI due today' });
    });

    it('lead a merged notification, with the evening nudge as a line under it', () => {
      const { notifications } = plan({ prefs: { ...prefs, morningEnabled: false }, loans: [loan()] });
      expect(find(notifications, at(5, 20))).toMatchObject({
        title: 'EMI due today',
        body: 'Test Person Bank · ₹12,500\nReview your payment in Loans.\nAdd anything you spent today',
        route: '/loans',
      });
    });
  });

  describe('weekly wrap', () => {
    const wrapPrefs = { ...prefs, weeklySummary: true };

    it('goes out on Mondays only, at the Morning time', () => {
      const { notifications } = plan({ prefs: wrapPrefs });
      const wraps = notifications.filter((n) => n.title === 'Your week, wrapped');
      expect(wraps.map((n) => n.id)).toEqual(['yume-2026-10-05-morning', 'yume-2026-10-12-morning']);
      expect(wraps[0]).toMatchObject({
        body: 'See where your money went and what stood out last week.',
        route: '/wrap?period=week',
      });
    });

    it('is not sent when off', () => {
      expect(plan().notifications.filter((n) => n.title === 'Your week, wrapped')).toHaveLength(0);
    });

    it('shares Monday evening with the nudge when the Morning is off', () => {
      const { notifications } = plan({ prefs: { ...wrapPrefs, morningEnabled: false } });
      expect(find(notifications, at(5, 20))).toMatchObject({
        title: 'Your week, wrapped',
        body: 'See where your money went and what stood out last week.\nAdd anything you spent today',
        route: '/wrap?period=week',
      });
    });

    it('comes after an EMI due the same Monday', () => {
      const { notifications } = plan({ prefs: wrapPrefs, loans: [loan()] });
      expect(find(notifications, at(5, 9))).toMatchObject({
        title: 'EMI due today',
        body: 'Test Person Bank · ₹12,500\nReview your payment in Loans.\nYour week, wrapped',
        route: '/loans',
      });
    });
  });

  describe('the evening nudge', () => {
    it('skips today when something is already logged, but not the days after', () => {
      const { notifications } = plan({ loggedToday: true });
      expect(find(notifications, at(3, 20))).toBeUndefined();
      expect(find(notifications, at(4, 20))).toBeDefined();
    });

    it('keeps the daily morning check-in when Evening is off', () => {
      const { notifications } = plan({ prefs: { ...prefs, eveningEnabled: false } });
      expect(notifications).toHaveLength(PLAN_DAYS);
      expect(notifications.every((n) => n.title === 'Your day, at a glance')).toBe(true);
    });

    it('moves to the chosen Evening time', () => {
      const { notifications } = plan({ prefs: { ...prefs, eveningHour: 21, eveningMinute: 30 } });
      expect(notifications.find((n) => n.id.endsWith('-evening'))?.at).toEqual(at(3, 21, 30));
    });

    it('skips today once its time has passed', () => {
      const { notifications } = plan({ now: new Date(2026, 9, 3, 21, 0) });
      expect(notifications.find((n) => n.id.endsWith('-evening'))?.id).toBe('yume-2026-10-04-evening');
    });
  });

  describe('spending alerts', () => {
    it('wait for the next time after they came up', () => {
      const { notifications, waitingAlerts } = plan({ alerts: [alert()] });
      expect(waitingAlerts).toEqual([expect.objectContaining({ scheduledFor: at(3, 20).toISOString() })]);
      expect(find(notifications, at(3, 20))).toMatchObject({
        title: 'Food is over budget',
        body: '₹1,050 of ₹1,000 this month.\nAdd anything you spent today',
        route: '/budgets',
      });
    });

    it("queued in the early morning go out at that morning's time", () => {
      const { notifications } = plan({
        alerts: [alert({ queuedAt: new Date(2026, 9, 3, 6, 0).toISOString() })],
      });
      expect(find(notifications, at(3, 9))).toMatchObject({ title: 'Food is over budget' });
    });

    it('lead over the evening nudge and the wrap, and merge several into one', () => {
      const { notifications } = plan({
        prefs: { ...prefs, weeklySummary: true },
        now: new Date(2026, 9, 5, 7, 0),
        alerts: [
          alert({ queuedAt: new Date(2026, 9, 5, 6, 0).toISOString() }),
          alert({
            id: 'spike:Dining:2026-10',
            queuedAt: new Date(2026, 9, 5, 6, 30).toISOString(),
            title: 'Dining is up 40%',
            body: 'Compared with last month.',
            extra: 'Dining is up 40% on last month',
            route: '/reports',
          }),
        ],
      });
      const morning = find(notifications, new Date(2026, 9, 5, 9));
      expect(morning?.title).toBe('Food is over budget');
      expect(morning?.body).toBe(
        '₹1,050 of ₹1,000 this month.\nDining is up 40% on last month\nYour week, wrapped'
      );
    });

    it('consume an accepted alert once its slot has passed', () => {
      const old = alert({ queuedAt: at(2, 12).toISOString(), scheduledFor: at(2, 20).toISOString() });
      const { notifications, waitingAlerts } = plan({ alerts: [old] });
      expect(waitingAlerts).toEqual([]);
      expect(notifications.map((n) => n.title)).not.toContain('Food is over budget');
    });

    it('retries an unscheduled alert at the next slot after permission or scheduling recovers', () => {
      const old = alert({ queuedAt: at(2, 12).toISOString() });
      const { notifications, waitingAlerts } = plan({ alerts: [old] });
      expect(find(notifications, at(3, 9))?.title).toBe('Food is over budget');
      expect(waitingAlerts[0].scheduledFor).toBe(at(3, 9).toISOString());
    });

    it('removes future acceptance when both slots are disabled so the alert can retry on re-enable', () => {
      const pending = alert({ scheduledFor: at(3, 20).toISOString() });
      const off = plan({
        alerts: [pending],
        prefs: { ...prefs, morningEnabled: false, eveningEnabled: false },
      });
      expect(off.waitingAlerts).toEqual([alert()]);
    });

    it('are dropped as stale after three days when no time was on to send them', () => {
      const off = { ...prefs, morningEnabled: false, eveningEnabled: false };
      const fresh = alert({ queuedAt: new Date(2026, 9, 2, 12, 0).toISOString() });
      const stale = alert({ id: 'x', queuedAt: new Date(2026, 8, 28, 12, 0).toISOString() });
      expect(plan({ prefs: off, alerts: [fresh, stale] }).waitingAlerts).toEqual([fresh]);
    });

    it('does not schedule a retry beyond the original three-day expiry', () => {
      const nearlyExpired = alert({ queuedAt: new Date(2026, 8, 30, 8).toISOString() });
      const result = plan({ alerts: [nearlyExpired] });
      expect(result.waitingAlerts).toEqual([]);
      expect(find(result.notifications, at(3, 9))?.title).toBe('Your day, at a glance');
    });

    it('are not sent when spending alerts are off', () => {
      const { notifications, waitingAlerts } = plan({
        prefs: { ...prefs, overspendAlerts: false },
        alerts: [alert()],
      });
      expect(waitingAlerts).toEqual([]);
      expect(notifications.map((n) => n.title)).not.toContain('Food is over budget');
    });

    it('ignore an alert with an unreadable time', () => {
      expect(plan({ alerts: [alert({ queuedAt: 'not a date' })] }).waitingAlerts).toEqual([]);
    });
  });

  it('does not repeat elapsed EMI, bill, refund or weekly topics at Evening after a rebuild', () => {
    const input = {
      prefs: { ...prefs, recurringAlerts: true, refundAlerts: true, weeklySummary: true },
      now: at(5, 7),
      loans: [loan()],
      attention: [
        { kind: 'bill' as const, id: 'internet', label: 'Internet', date: '2026-10-06' },
        { kind: 'refund' as const, id: 'refund', label: 'Shoes', date: '2026-10-05' },
      ],
    };
    const morning = find(plan(input).notifications, at(5, 9))!;
    const previouslyScheduled = morning.reminderKeys.map((key) => ({ key, at: morning.at.toISOString() }));
    const after = plan({ ...input, now: at(5, 10), previouslyScheduled });
    expect(find(after.notifications, at(5, 20))?.title).toBe('Before you call it a day');
    expect(find(after.notifications, at(6, 9))?.title).toBe('EMI overdue');
    expect(find(after.notifications, at(8, 9))?.body).toContain('Shoes: refund follow-up');
  });

  it('replans delayed requests still pending in Android instead of treating their passed time as consumed', () => {
    const delayed = alert({
      queuedAt: at(3, 6).toISOString(),
      scheduledFor: at(3, 9).toISOString(),
      scheduledNotificationId: 'yume-2026-10-03-morning',
    });
    const result = plan({
      now: at(3, 10),
      loans: [loan({ dueDate: '2026-10-03' })],
      alerts: [delayed],
      previouslyScheduled: [
        { key: '2026-10-03:emi:l1', at: at(3, 9).toISOString(), notificationId: 'yume-2026-10-03-morning' },
      ],
      pendingNotificationIds: ['yume-2026-10-03-morning'],
    });
    expect(find(result.notifications, at(3, 20))?.body).toContain('Food is over budget');
    expect(find(result.notifications, at(3, 20))?.title).toBe('EMI due today');
    expect(result.waitingAlerts[0]).toMatchObject({
      scheduledFor: at(3, 20).toISOString(),
      scheduledNotificationId: 'yume-2026-10-03-evening',
    });
  });
});
