import { emiCopy, logCopy, wrapCopy } from './notificationCopy';
import { clampSlotMinutes, TimeSlotKind } from './notificationTimes';
import { toLocalIsoDate } from './date';

/**
 * What Yume will notify about in the coming days, planned in one place so two never land together.
 * At most two times a day (notificationTimes.ts); items due together merge into one, most pressing first.
 */

/** The screens a notification can open; a payload naming anything else is ignored. */
export const NOTIFICATION_ROUTES = [
  '/add-transaction',
  '/loans',
  '/reports',
  '/budgets',
  '/wrap?period=week',
] as const;
export type NotificationRoute = (typeof NOTIFICATION_ROUTES)[number];

/** How many days ahead the daily and Monday notifications are scheduled. */
export const PLAN_DAYS = 14;
/** A spending alert nobody could be notified about (both times off) is dropped after this long. */
export const ALERT_MAX_AGE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A spending alert (a budget limit, a big jump) waiting for the next time. */
export interface QueuedAlert {
  /** Stable per alert, so queuing the same one twice keeps one. */
  id: string;
  /** When it came up (ISO); it goes out at the first time on or after this. */
  queuedAt: string;
  title: string;
  body: string;
  extra: string;
  route: NotificationRoute;
}

/** A borrowed loan's next installment. */
export interface PlanLoan {
  id: string;
  counterparty: string;
  /** YYYY-MM-DD */
  dueDate: string;
  emiMinor: number;
}

export interface PlanPrefs {
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

export interface PlannedNotification {
  /** Always starts with `yume-`, which is how a rebuild finds what to cancel. */
  id: string;
  at: Date;
  title: string;
  body: string;
  route: NotificationRoute;
}

interface Entry {
  title: string;
  body: string;
  extra: string;
  route: NotificationRoute;
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
  prefs: PlanPrefs;
  loans: PlanLoan[];
  alerts: QueuedAlert[];
  loggedToday: boolean;
  now: Date;
}): { notifications: PlannedNotification[]; waitingAlerts: QueuedAlert[] } {
  const { prefs, loans, alerts, loggedToday, now } = input;
  const slots = enabledSlots(prefs);
  const today = startOfDay(now);

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

  // EMIs go out on the day they are due, at the first time that is still ahead.
  // Not limited to the 14 days: a late due date should still be reminded of.
  if (prefs.billAlerts) {
    const byDate = new Map<string, PlanLoan[]>();
    for (const loan of loans) byDate.set(loan.dueDate, [...(byDate.get(loan.dueDate) ?? []), loan]);
    for (const [iso, group] of byDate) {
      const day = parseIsoDate(iso);
      if (daysBetween(today, day) < 0) continue;
      const slot = firstSlotOn(day);
      if (slot) add(day, slot, { ...emiCopy(group), route: '/loans' });
    }
  }

  for (let i = 0; i < PLAN_DAYS; i++) {
    const day = startOfDay(today, i);
    if (prefs.weeklySummary && day.getDay() === 1) {
      const slot = firstSlotOn(day);
      if (slot) add(day, slot, { ...wrapCopy(), route: '/wrap?period=week' });
    }
    // The nudge to log goes at the Evening time only, and not on a day something is already logged.
    const evening = slots.find((s) => s.kind === 'evening');
    if (evening && slotTime(day, evening) > now && !(i === 0 && loggedToday)) {
      add(day, evening, { ...logCopy(), route: '/add-transaction' });
    }
  }

  // A spending alert goes out at the first time on or after it arose; a passed time means delivered,
  // and one with no time to go out at keeps waiting until it is stale.
  const waitingAlerts: QueuedAlert[] = [];
  if (prefs.overspendAlerts) {
    for (const alert of alerts) {
      const queuedAt = new Date(alert.queuedAt);
      if (Number.isNaN(queuedAt.getTime())) continue;
      if (now.getTime() - queuedAt.getTime() > ALERT_MAX_AGE_DAYS * DAY_MS) continue;
      let found: { day: Date; slot: Slot } | undefined;
      for (let i = 0; i <= ALERT_MAX_AGE_DAYS + 1 && !found; i++) {
        const day = startOfDay(queuedAt, i);
        const slot = slots.find((s) => slotTime(day, s) >= queuedAt);
        if (slot) found = { day, slot };
      }
      if (!found) {
        waitingAlerts.push(alert);
        continue;
      }
      if (slotTime(found.day, found.slot) <= now) continue; // already delivered
      waitingAlerts.push(alert);
      add(found.day, found.slot, alert);
    }
  }

  const notifications = [...due.entries()]
    .map(([id, { day, slot, entries }]): PlannedNotification => {
      // `entries` order is: EMIs, Monday's wrap and log nudge, then spending alerts (as added).
      // Leading order is alerts and EMIs, then the wrap, then the log nudge.
      const lead = [...entries].sort((a, b) => priority(a) - priority(b))[0];
      const rest = entries.filter((e) => e !== lead).sort((a, b) => priority(a) - priority(b));
      return {
        id,
        at: slotTime(day, slot),
        title: lead.title,
        body: [lead.body, ...rest.map((e) => e.extra)].join('\n'),
        route: lead.route,
      };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return { notifications, waitingAlerts };
}

function priority(entry: Entry): number {
  switch (entry.route) {
    case '/loans':
      return 0;
    case '/budgets':
    case '/reports':
      return 1;
    case '/wrap?period=week':
      return 2;
    default:
      return 3;
  }
}
