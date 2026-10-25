// Notification routes and the queued-alert shape, apart from notificationPlan: settings stores queued alerts, and
// the planner's copy helpers read settings (through money formatting).

/** The screens a notification can open; a payload naming anything else is ignored. */
export const NOTIFICATION_ROUTES = [
  '/add-transaction',
  '/(tabs)/plan',
  '/loans',
  '/recurring',
  '/reports',
  '/budgets',
  '/wrap?period=week',
] as const;
export type NotificationRoute = (typeof NOTIFICATION_ROUTES)[number];

/** A topic accepted for a slot; retained briefly so rebuilding later that day cannot repeat it. */
export interface ScheduledReminder {
  key: string;
  at: string;
  notificationId?: string;
}

/** A spending alert (a budget limit, a big jump) waiting for the next time. */
export interface QueuedAlert {
  /** Stable per alert, so queuing the same one twice keeps one. */
  id: string;
  /** When it came up (ISO); it goes out at the first time on or after this. */
  queuedAt: string;
  /** Slot accepted by the OS scheduler. Passing a requested time alone is not evidence of scheduling. */
  scheduledFor?: string;
  scheduledNotificationId?: string;
  title: string;
  body: string;
  extra: string;
  route: NotificationRoute;
  /** Re-resolve spending copy against live data/privacy before scheduling. Older queues lack this. */
  source?:
    | { kind: 'budget'; budgetId: string; periodMonth: string; level: 'near' | 'over' }
    | { kind: 'spike'; categoryId: string; periodMonth: string };
}
