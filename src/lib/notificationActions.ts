import * as Notifications from 'expo-notifications';
import { addBudgetNudgesSent } from '@/db/settings';

/**
 * The buttons on Yume's notifications. Each kind of notification belongs to
 * one category, and a category is its set of buttons (registered once on
 * start-up; Android keeps them). Two kinds of button:
 *
 * - Buttons that open a screen ("Add expense", "Pay now", "Play"). These
 *   route through the same tap handling as tapping the notification itself.
 * - Quiet buttons ("In 1 hour", "Tomorrow", "Quiet this month") that do their
 *   job without opening Yume. Android runs those through the background task
 *   in notificationTask.ts; one tapped while the app is open arrives through
 *   the normal listener instead. Both paths call `runQuietAction`, and every
 *   quiet action is safe to run twice.
 */
export const NOTIFICATION_KIND = {
  daily: 'yume-daily',
  emi: 'yume-emi',
  budget: 'yume-budget',
  wrap: 'yume-wrap',
  spike: 'yume-spike',
} as const;
type NotificationKind = keyof typeof NOTIFICATION_KIND;

const open = { opensAppToForeground: true };
const quiet = { opensAppToForeground: false };

const CATEGORY_ACTIONS: Record<NotificationKind, Notifications.NotificationAction[]> = {
  daily: [
    { identifier: 'add', buttonTitle: 'Add expense', options: open },
    {
      identifier: 'type',
      buttonTitle: 'Type it in',
      textInput: { submitButtonTitle: 'Add', placeholder: '250 lunch' },
      options: open,
    },
    { identifier: 'later', buttonTitle: 'In 1 hour', options: quiet },
  ],
  emi: [
    { identifier: 'pay', buttonTitle: 'Pay now', options: open },
    { identifier: 'tomorrow', buttonTitle: 'Tomorrow', options: quiet },
  ],
  budget: [
    { identifier: 'see', buttonTitle: 'See budget', options: open },
    { identifier: 'quiet', buttonTitle: 'Quiet this month', options: quiet },
  ],
  wrap: [
    { identifier: 'play', buttonTitle: 'Play', options: open },
    { identifier: 'tonight', buttonTitle: 'Tonight', options: quiet },
  ],
  spike: [
    { identifier: 'see', buttonTitle: 'See where', options: open },
    { identifier: 'got-it', buttonTitle: 'Got it', options: quiet },
  ],
};

/** Registers every category's buttons. Run on start-up, before anything is scheduled. */
export async function registerNotificationCategories(): Promise<void> {
  await Promise.all(
    (Object.keys(CATEGORY_ACTIONS) as NotificationKind[]).map((kind) =>
      Notifications.setNotificationCategoryAsync(NOTIFICATION_KIND[kind], CATEGORY_ACTIONS[kind])
    )
  );
}

const QUIET_ACTIONS = ['later', 'tomorrow', 'tonight', 'quiet', 'got-it'] as const;
type QuietAction = (typeof QUIET_ACTIONS)[number];

export function isQuietAction(actionIdentifier: string): actionIdentifier is QuietAction {
  return (QUIET_ACTIONS as readonly string[]).includes(actionIdentifier);
}

/**
 * Where tapping each kind of Yume notification takes you: the daily
 * reminder opens Add (it's asking you to log something), an EMI reminder
 * opens Loans, the Monday one plays last week's Wrap, an overspend alert
 * opens Reports, and a budget nudge opens Budgets. A fixed list — a
 * notification can only ever route to one of these, whatever its payload
 * says. A few buttons add details to the route (see `responseRoute`).
 */
export const NOTIFICATION_ROUTES = [
  '/add-transaction',
  '/loans',
  '/reports',
  '/budgets',
  '/wrap?period=week',
] as const;
export type NotificationRoute =
  (typeof NOTIFICATION_ROUTES)[number] | `/add-transaction?${string}` | `/loans?pay=${string}`;

/** The route a tapped notification asks for, or null if it carries none this app knows. */
export function notificationRoute(
  response: Notifications.NotificationResponse | null
): (typeof NOTIFICATION_ROUTES)[number] | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && (NOTIFICATION_ROUTES as readonly string[]).includes(url)
    ? (url as (typeof NOTIFICATION_ROUTES)[number])
    : null;
}

/**
 * The screen a tap opens. Tapping the notification, or a button such as
 * "Add expense", "See budget" or "Play", goes where the notification itself
 * points. "Type it in" opens Add with the typed amount and note, and
 * "Pay now" opens that EMI's pay sheet. Quiet buttons open nothing.
 */
export function responseRoute(response: Notifications.NotificationResponse | null): NotificationRoute | null {
  if (!response || isQuietAction(response.actionIdentifier)) return null;
  if (response.actionIdentifier === 'type') return quickReplyRoute(response.userText);
  if (response.actionIdentifier === 'pay') {
    const loanId = response.notification.request.content.data?.loanId;
    return typeof loanId === 'string' && /^[\w-]+$/.test(loanId) ? `/loans?pay=${loanId}` : '/loans';
  }
  return notificationRoute(response);
}

/** The most a typed note carries into Add. */
const REPLY_NOTE_MAX = 80;

/**
 * Reads a reply typed into the daily reminder, such as "250 lunch",
 * "₹1,200 rent" or "coffee 80.50": the first number is the amount (in minor
 * units) and the rest is the note. Either can be missing.
 */
export function parseQuickReply(text: string | undefined): { amountMinor: number | null; note: string } {
  const clean = (text ?? '').trim();
  const match = clean.match(/(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)/i);
  const amount = match ? Number(match[1].replace(/,/g, '')) : NaN;
  const amountMinor = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
  const rest = match && amountMinor != null ? clean.replace(match[0], ' ') : clean;
  const note = rest
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(for|on)\s+/i, '')
    .slice(0, REPLY_NOTE_MAX)
    .trim();
  return { amountMinor, note };
}

function quickReplyRoute(text: string | undefined): NotificationRoute {
  const { amountMinor, note } = parseQuickReply(text);
  const params = [
    amountMinor != null ? `amount=${amountMinor}` : null,
    note ? `note=${encodeURIComponent(note)}` : null,
  ].filter((p): p is string => p != null);
  return params.length > 0 ? `/add-transaction?${params.join('&')}` : '/add-transaction';
}

/** Hour the EMI reminder repeats at, the same 9 AM as the first one. */
const EMI_HOUR = 9;
/** "Tonight" means 8 PM, unless that is under half an hour away. */
const TONIGHT_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

/** When a snooze button brings the notification back. */
export function snoozeUntil(action: 'later' | 'tomorrow' | 'tonight', now: Date): Date {
  if (action === 'tomorrow') {
    const at = new Date(now);
    at.setDate(at.getDate() + 1);
    at.setHours(EMI_HOUR, 0, 0, 0);
    return at;
  }
  if (action === 'tonight') {
    const at = new Date(now);
    at.setHours(TONIGHT_HOUR, 0, 0, 0);
    if (at.getTime() - now.getTime() >= HOUR_MS / 2) return at;
  }
  return new Date(now.getTime() + HOUR_MS);
}

/**
 * Does what a quiet button asks: clears the notification, then brings it
 * back later (a snooze), or stops this budget's nudges for the month. A
 * snooze reuses one identifier per kind, so running it twice keeps one.
 */
/** Kept as 'default' so a phone that already has the channel keeps its sound/importance settings. */
export const NOTIFICATION_CHANNEL_ID = 'default';

export async function runQuietAction(response: Notifications.NotificationResponse): Promise<void> {
  const action = response.actionIdentifier;
  if (!isQuietAction(action)) return;
  const request = response.notification.request;
  await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});

  if (action === 'later' || action === 'tomorrow' || action === 'tonight') {
    const { title, body, data, categoryIdentifier } = request.content;
    await Notifications.scheduleNotificationAsync({
      identifier: `yume-snooze-${categoryIdentifier ?? action}`,
      content: {
        title: title ?? '',
        body: body ?? '',
        data: data ?? {},
        categoryIdentifier: categoryIdentifier ?? undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: snoozeUntil(action, new Date()),
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });
    return;
  }
  if (action === 'quiet') {
    // The same keys the budget check records once a nudge is sent, so it
    // treats both this month's nudges as already sent.
    const key = request.content.data?.budgetKey;
    if (typeof key === 'string') await addBudgetNudgesSent([`${key}:near`, `${key}:over`]);
  }
  // 'got-it' only clears it: an overspend alert already comes once per category a month.
}
