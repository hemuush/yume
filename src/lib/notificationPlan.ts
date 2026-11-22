import {
  billCopy,
  emiCopy,
  emiOverdueCopy,
  keepGoingCopy,
  logCopy,
  refundCopy,
  wrapCopy,
} from './notificationCopy';
import { formatMoney } from './money';
import { dayMonth } from './dateLabels';
import { clampSlotMinutes, TimeSlotKind } from './notificationTimes';
import { toLocalIsoDate, addDaysToIsoDate } from './date';
import {
  NOTIFICATION_ROUTES,
  type NotificationRoute,
  type QueuedAlert,
  type ScheduledReminder,
} from './queuedAlert';

export { NOTIFICATION_ROUTES };
export type { NotificationRoute, QueuedAlert };

/**
 * What Yume will notify about in the coming days, planned in one place so two never land together.
 * At most two times a day (notificationTimes.ts); items due together merge into one, most pressing first.
 */

/** How many days ahead the daily and Monday notifications are scheduled. */
export const PLAN_DAYS = 14;
/** An unpaid EMI is reminded of once a day for this many days after its due day, then left to the app. */
const OVERDUE_EMI_DAYS = 7;
/** A spending alert nobody could be notified about (both times off) is dropped after this long. */
const ALERT_MAX_AGE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A borrowed loan's next installment. */
export interface PlanLoan {
  id: string;
  counterparty: string;
  /** YYYY-MM-DD */
  dueDate: string;
  emiMinor: number;
}

export interface PlanPrefs {
  recurringAlerts?: boolean;
  refundAlerts?: boolean;
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
  eveningEnabled: boolean;
  eveningHour: number;
  eveningMinute: number;
  overspendAlerts: boolean;
  billAlerts: boolean;
  weeklySummary: boolean;
}

interface PlannedNotification {
  /** Always starts with `yume-`, which is how a rebuild finds what to cancel. */
  id: string;
  at: Date;
  title: string;
  body: string;
  route: NotificationRoute;
  reminderKeys: string[];
}

interface Entry {
  title: string;
  body: string;
  extra: string;
  route: NotificationRoute;
  reminderKeys?: string[];
}

interface Slot {
  kind: TimeSlotKind;
  minutes: number;
}

function enabledSlots(prefs: PlanPrefs): Slot[] {
  const slots: Slot[] = [];
  if (prefs.morningEnabled) {
    slots.push({
      kind: 'morning',
      minutes: clampSlotMinutes('morning', prefs.morningHour * 60 + prefs.morningMinute),
    });
  }
  if (prefs.eveningEnabled) {
    slots.push({
      kind: 'evening',
      minutes: clampSlotMinutes('evening', prefs.eveningHour * 60 + prefs.eveningMinute),
    });
  }
  return slots;
}

function startOfDay(date: Date, plusDays = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + plusDays);
}

function slotTime(day: Date, slot: Slot): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, slot.minutes);
}

function slotId(day: Date, slot: Slot): string {
  return `yume-${toLocalIsoDate(day)}-${slot.kind}`;
}

/** The days between two dates, counted on the calendar. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function planNotifications(input: {
  attention?: {
    kind: 'bill' | 'refund';
    id: string;
    label: string;
    date: string;
    /** The bill's amount or the refund expected, in minor units; left out when unknown. */
    amountMinor?: number;
    currency?: string;
  }[];
  prefs: PlanPrefs;
  loans: PlanLoan[];
  alerts: QueuedAlert[];
  loggedToday: boolean;
  now: Date;
  previouslyScheduled?: ScheduledReminder[];
  pendingNotificationIds?: string[];
}): { notifications: PlannedNotification[]; waitingAlerts: QueuedAlert[] } {
  const { prefs, loans, alerts, loggedToday, now } = input;
  const slots = enabledSlots(prefs);
  const today = startOfDay(now);
  const pendingIds = new Set(input.pendingNotificationIds ?? []);
  const elapsedTopics = new Set(
    (input.previouslyScheduled ?? [])
      .filter(
        (item) => new Date(item.at).getTime() <= now.getTime() && !pendingIds.has(item.notificationId ?? '')
      )
      .map((item) => item.key)
  );
  const topicKey = (day: Date, kind: string, id = '') => `${toLocalIsoDate(day)}:${kind}:${id}`;

  // What is due at each time, keyed by the time's own id.
  const due = new Map<string, { day: Date; slot: Slot; entries: Entry[] }>();
  const add = (day: Date, slot: Slot, entry: Entry) => {
    const id = slotId(day, slot);
    const bucket = due.get(id) ?? { day, slot, entries: [] };
    bucket.entries.push(entry);
    due.set(id, bucket);
  };
  /** The first time on `day` that is still ahead of us. */
  const firstSlotOn = (day: Date): Slot | undefined => slots.find((s) => slotTime(day, s) > now);

  for (const item of input.attention ?? []) {
    if ((item.kind === 'bill' && !prefs.recurringAlerts) || (item.kind === 'refund' && !prefs.refundAlerts))
      continue;
    const dates =
      item.kind === 'bill' ? [addDaysToIsoDate(item.date, -1)] : [item.date, addDaysToIsoDate(item.date, 3)];
    for (const iso of dates) {
      const day = parseIsoDate(iso);
      if (daysBetween(today, day) < 0 || daysBetween(today, day) >= PLAN_DAYS) continue;
      const key = topicKey(day, item.kind, item.id);
      if (elapsedTopics.has(key)) continue;
      const slot = firstSlotOn(day);
      if (!slot) continue;
      const late = item.kind === 'refund' && iso !== item.date;
      const amount = item.amountMinor != null ? formatMoney(item.amountMinor, item.currency) : null;
      add(day, slot, {
        ...(item.kind === 'bill' ? billCopy(item.label, amount) : refundCopy(item.label, amount, late)),
        route: item.kind === 'bill' ? '/recurring' : '/(tabs)/plan',
        reminderKeys: [key],
      });
    }
  }

  // EMIs go out on the day they are due, at the first time that is still ahead.
  // Not limited to the 14 days: a late due date should still be reminded of.
  if (prefs.billAlerts) {
    const byDate = new Map<string, PlanLoan[]>();
    for (const loan of loans) {
      if (elapsedTopics.has(topicKey(parseIsoDate(loan.dueDate), 'emi', loan.id))) continue;
      byDate.set(loan.dueDate, [...(byDate.get(loan.dueDate) ?? []), loan]);
    }
    for (const [iso, group] of byDate) {
      const day = parseIsoDate(iso);
      if (daysBetween(today, day) < 0) continue;
      const slot = firstSlotOn(day);
      if (slot)
        add(day, slot, {
          ...emiCopy(group),
          route: '/loans',
          reminderKeys: group.map((loan) => topicKey(day, 'emi', loan.id)),
        });
    }
    // Missed the day: once a day until it's paid, for up to OVERDUE_EMI_DAYS after it was due. (Paying it
    // rebuilds the plan, which drops these.)
    for (let i = 0; i < PLAN_DAYS; i++) {
      const day = startOfDay(today, i);
      const overdue = loans.filter((l) => {
        const late = daysBetween(parseIsoDate(l.dueDate), day);
        return late > 0 && late <= OVERDUE_EMI_DAYS && !elapsedTopics.has(topicKey(day, 'emi', l.id));
      });
      if (overdue.length === 0) continue;
      const slot = firstSlotOn(day);
      if (slot)
        add(day, slot, {
          ...emiOverdueCopy(
            overdue.map((l) => ({ ...l, daysLate: daysBetween(parseIsoDate(l.dueDate), day) })),
            dayMonth
          ),
          route: '/loans',
          reminderKeys: overdue.map((loan) => topicKey(day, 'emi', loan.id)),
        });
    }
  }

  for (let i = 0; i < PLAN_DAYS; i++) {
    const day = startOfDay(today, i);
    if (prefs.weeklySummary && day.getDay() === 1 && !elapsedTopics.has(topicKey(day, 'wrap'))) {
      const slot = firstSlotOn(day);
      if (slot)
        add(day, slot, { ...wrapCopy(), route: '/wrap?period=week', reminderKeys: [topicKey(day, 'wrap')] });
    }
    // The nudge to log goes at the Evening time only, and not on a day something is already logged.
    const evening = slots.find((s) => s.kind === 'evening');
    if (evening && slotTime(day, evening) > now && !(i === 0 && loggedToday)) {
      add(day, evening, { ...logCopy(day.getDay()), route: '/add-transaction' });
    }
  }

  // The day after the plan ends: a reminder to open the app. Any open rebuilds the plan and replaces it, so it only
  // ever shows when Yume was not opened for the whole plan, which is when the reminders would otherwise stop silently.
  const first = slots[0];
  if (first) add(startOfDay(today, PLAN_DAYS), first, { ...keepGoingCopy(), route: '/(tabs)/plan' });

  // A passed slot consumes an alert only after the OS accepted it. Permission/scheduler failures
  // leave it waiting for the next enabled time, within its original three-day lifetime.
  const waitingAlerts: QueuedAlert[] = [];
  if (prefs.overspendAlerts) {
    for (const alert of alerts) {
      const queuedAt = new Date(alert.queuedAt);
      if (Number.isNaN(queuedAt.getTime())) continue;
      if (now.getTime() - queuedAt.getTime() > ALERT_MAX_AGE_DAYS * DAY_MS) continue;
      if (
        alert.scheduledFor &&
        new Date(alert.scheduledFor).getTime() <= now.getTime() &&
        !pendingIds.has(alert.scheduledNotificationId ?? '')
      )
        continue;
      let found: { day: Date; slot: Slot } | undefined;
      for (let i = 0; i <= ALERT_MAX_AGE_DAYS + 1 && !found; i++) {
        const day = startOfDay(queuedAt > now ? queuedAt : now, i);
        const slot = slots.find((s) => slotTime(day, s) >= queuedAt && slotTime(day, s) > now);
        if (slot) found = { day, slot };
      }
      const pending = { ...alert };
      delete pending.scheduledFor;
      delete pending.scheduledNotificationId;
      if (!found) {
        waitingAlerts.push(pending);
        continue;
      }
      if (slotTime(found.day, found.slot).getTime() - queuedAt.getTime() > ALERT_MAX_AGE_DAYS * DAY_MS)
        continue;
      // The scheduler persists this marker only for requests it successfully submits.
      waitingAlerts.push({
        ...pending,
        scheduledFor: slotTime(found.day, found.slot).toISOString(),
        scheduledNotificationId: slotId(found.day, found.slot),
      });
      add(found.day, found.slot, alert);
    }
  }

  // Morning has no message of its own: it carries what is due that day, and a day with nothing due gets no
  // notification at all (a daily "check your plans" is what gets every other notification ignored).

  const notifications = [...due.entries()]
    .map(([id, { day, slot, entries }]): PlannedNotification => {
      // EMIs lead, then bills/spending alerts, refunds, the wrap and the logging nudge.
      const lead = [...entries].sort((a, b) => priority(a) - priority(b))[0];
      const rest = entries.filter((e) => e !== lead).sort((a, b) => priority(a) - priority(b));
      return {
        id,
        at: slotTime(day, slot),
        title: lead.title,
        body: [lead.body, ...rest.map((e) => e.extra)].join('\n'),
        route: lead.route,
        reminderKeys: entries.flatMap((entry) => entry.reminderKeys ?? []),
      };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return { notifications, waitingAlerts };
}

function priority(entry: Entry): number {
  switch (entry.route) {
    case '/loans':
      return 0;
    case '/recurring':
    case '/budgets':
    case '/reports':
      return 1;
    case '/(tabs)/plan':
      return 2;
    case '/wrap?period=week':
      return 3;
    default:
      return 4;
  }
}
