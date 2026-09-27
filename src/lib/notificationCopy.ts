import { pickRandom } from './pickRandom';

/**
 * Wording pools for every push notification Yume sends — ~20 title/body
 * variants per notification, one picked at random each time that
 * notification is (re)scheduled or fired, via `pickRandom`.
 *
 * The daily reminder and weekly summary are *repeating* OS triggers
 * (`SchedulableTriggerInputTypes.DAILY`/`WEEKLY`) — Android/iOS hold the
 * exact payload handed to them at schedule time and reuse it for every
 * future firing, there's no hook to re-roll the wording each time the OS
 * fires it without the app running. So for those two, "rotates" honestly
 * means "picks a fresh variant each time `syncDailyReminder`/
 * `syncWeeklySummary` (re)schedules it" — which already happens on every
 * cold start (`app/_layout.tsx`) and every save of the notification
 * settings, not literally once per calendar day if the app goes unopened.
 * The loan-due reminder and the overspend alert are each scheduled fresh at
 * the exact moment they're needed (a loan is created/paid, a transaction
 * pushes a category over its prior month), so those two get a true
 * every-single-time rotation with no caveat.
 */

export interface NotificationCopy {
  title: string;
  body: string;
}

/** No dynamic content — a nudge to log today's spending. */
export const DAILY_REMINDER_COPY: readonly NotificationCopy[] = [
  { title: 'A minute for Yume?', body: "Log today's spending while it's still fresh 🌱" },
  { title: 'Quick one before bed?', body: "Today's spending, logged in under a minute." },
  { title: 'One small habit', body: 'A minute now saves a guessing game later. What went out today?' },
  { title: 'Still time today', body: 'Log what you spent today — future you will thank you.' },
  { title: "Don't lose today", body: "A day unlogged is a day your numbers won't quite trust." },
  { title: 'Yume here', body: "Got a minute? Today's spending is easiest to log while it's fresh." },
  { title: 'Before you forget', body: "Log today's spending now — it gets fuzzier by tomorrow." },
  { title: 'Small check-in', body: 'What moved today? A minute now keeps the picture clear.' },
  { title: 'A quick log?', body: "Today's transactions, in and out — one minute, tops." },
  { title: 'Keep the streak honest', body: 'Log today before it blurs into tomorrow.' },
  { title: 'Two taps, one habit', body: "Add today's spending — it only takes a moment." },
  { title: 'Fresh in memory', body: 'Log it now while you still remember every rupee.' },
  { title: 'Yume check-in', body: 'A minute today keeps your numbers honest tomorrow.' },
  { title: 'Worth a minute', body: "Today's expenses are still fresh — log them now." },
  { title: 'End-of-day habit', body: 'Close today out — log whatever moved.' },
  { title: 'Quick nudge', body: 'Anything to log from today? Takes barely a minute.' },
  { title: 'Before the day slips away', body: "Log today's spending while it's easy to recall." },
  { title: "Suu's reminder", body: "I'm listening — log today's spending whenever you're ready." },
  { title: 'One more habit rep', body: "Today's numbers, logged. That's the whole ask." },
  { title: 'Tiny task, big payoff', body: "Log today's spending — a minute now, clarity later." },
];

/** No dynamic content: an invitation, on Monday, to play the week just closed as a Wrap. */
export const WEEKLY_SUMMARY_COPY: readonly NotificationCopy[] = [
  { title: 'Your week, wrapped', body: '8 seconds on how last week went. Tap to play.' },
  { title: 'Week in review', body: 'Last week as a short story. Tap to play.' },
  { title: 'Monday check-in', body: 'How last week went, in 8 seconds. Tap to play.' },
  { title: 'How was the week?', body: 'A quick look back at where the money went. Tap to play.' },
  { title: "Last week's story", body: 'Seven days, one short wrap. Tap to play.' },
  { title: 'Weekly wrap', body: 'See how last week compared to your usual. Tap to play.' },
  { title: 'Seven days, summed up', body: 'Last week in 8 seconds, to start this one.' },
  { title: 'Week closed', body: 'The last seven days, wrapped. Tap to play.' },
  { title: 'A fresh week', body: 'A short look back at how last week went, money-wise.' },
  { title: 'Your rhythm last week', body: 'Which day did the most? Tap to see your week.' },
];

function fillNotificationTemplate(str: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [key, value]) => s.split(`{${key}}`).join(value), str);
}

/** `{counterparty}` and `{amount}` are filled in at schedule time. */
const LOAN_DUE_TEMPLATES: readonly NotificationCopy[] = [
  { title: 'EMI due today', body: '{counterparty} — {amount}. One step closer to done.' },
  { title: 'Due today', body: 'Your {counterparty} EMI of {amount} is due today.' },
  { title: "Today's the day", body: '{counterparty}: {amount} due today. Another one down soon.' },
  { title: 'EMI reminder', body: "{amount} for {counterparty} is due today — don't let it slip." },
  { title: 'Payment due', body: '{counterparty} — {amount} due today. Almost there.' },
  { title: 'One more EMI', body: '{counterparty}: {amount} is due today.' },
  { title: 'Due date is here', body: "Today's the due date for {counterparty} — {amount}." },
  { title: 'EMI check-in', body: '{amount} to {counterparty} is due today.' },
  { title: 'Loan reminder', body: "Don't forget: {counterparty} — {amount} — due today." },
  { title: 'A step closer', body: '{counterparty}: {amount} due today. Every EMI counts.' },
  { title: 'Today: EMI due', body: '{counterparty} — {amount}, due today.' },
  { title: 'Keep it on track', body: 'Your {counterparty} payment of {amount} is due today.' },
  { title: 'EMI day', body: '{amount} for {counterparty} — due today, as scheduled.' },
  { title: 'Payment reminder', body: '{counterparty}: {amount} is due today. One less to go after this.' },
  { title: 'Due now', body: "{counterparty}'s {amount} EMI is due today." },
  { title: 'On schedule', body: '{amount} to {counterparty} — due today, right on time.' },
  { title: "Don't miss it", body: '{counterparty}: {amount} due today.' },
  { title: 'Loan due today', body: 'The {amount} EMI for {counterparty} is due today.' },
  { title: 'Almost there', body: '{counterparty} — {amount} due today. Closer to paid off.' },
  { title: 'EMI due', body: '{amount} for {counterparty}, due today.' },
];

export function loanDueCopy(counterparty: string, amount: string): NotificationCopy {
  const t = pickRandom(LOAN_DUE_TEMPLATES);
  return {
    title: t.title,
    body: fillNotificationTemplate(t.body, { counterparty, amount }),
  };
}

/** `{category}` and `{pct}` are filled in at fire time. */
const OVERSPEND_TEMPLATES: readonly NotificationCopy[] = [
  { title: 'Worth a peek 👀', body: '{category} spending is up {pct} vs last month.' },
  { title: 'Noticed a jump', body: '{category} is up {pct} compared to last month.' },
  { title: 'Heads up', body: '{category} spending climbed {pct} versus last month.' },
  { title: 'A category to watch', body: '{category} is running {pct} hotter than last month.' },
  { title: 'Spotted a trend', body: '{category} spending grew {pct} over last month.' },
  { title: 'Worth checking', body: '{category} is {pct} above last month so far.' },
  { title: 'A quick flag', body: '{category} spending is up {pct} from last month.' },
  { title: 'One to watch', body: '{category} climbed {pct} versus last month.' },
  { title: 'Worth a look', body: '{category} is tracking {pct} above last month.' },
  { title: 'Something moved', body: '{category} spending rose {pct} compared to last month.' },
  { title: 'A pattern forming', body: '{category} is up {pct} on last month — worth a glance.' },
  { title: 'Category alert', body: '{category} spending jumped {pct} versus last month.' },
  { title: 'Just noticed', body: '{category} is {pct} higher than the same time last month.' },
  { title: 'Trending up', body: '{category} spending is {pct} above last month.' },
  { title: 'Worth a second look', body: '{category} climbed {pct} over last month.' },
  { title: 'A shift in spending', body: '{category} is up {pct} versus last month.' },
  { title: 'Flagging this one', body: '{category} spending rose {pct} from last month.' },
  { title: 'Keeping you posted', body: '{category} is running {pct} ahead of last month.' },
  { title: 'A category jumped', body: '{category} spending is up {pct} on last month.' },
  { title: 'Worth knowing', body: '{category} climbed {pct} compared to last month.' },
];

export function overspendCopy(categoryName: string, pctLabel: string): NotificationCopy {
  const t = pickRandom(OVERSPEND_TEMPLATES);
  return {
    title: t.title,
    body: fillNotificationTemplate(t.body, { category: categoryName, pct: pctLabel }),
  };
}

/** A budget passing 80% of its limit ('near'), or going over it. Plain and specific — no random templates. */
export function budgetNudgeCopy(
  level: 'near' | 'over',
  categoryName: string,
  spent: string,
  limit: string,
  left: string
): NotificationCopy {
  return level === 'over'
    ? {
        title: `${categoryName} went over budget`,
        body: `${spent} of ${limit} this month. Tap to see Budgets.`,
      }
    : {
        title: `${categoryName} is at 80% of its budget`,
        body: `${left} of ${limit} left this month. Suu's keeping an eye on it.`,
      };
}
