import { formatMoney } from './money';

/**
 * Wording of every Yume notification. Each leads with the fact and its number (who, how much, how late) and says
 * what is at stake, with no instruction to "tap" or "review": a notification is only read if the line itself is
 * worth reading. When several things are due together the first leads and the others join as extra lines, using
 * `extra` (a one-line form of the same thing).
 */
interface NotificationText {
  title: string;
  body: string;
  extra: string;
}

/**
 * The evening nudge, one line per weekday so it is not the same words every night. Each says what logging buys,
 * and one gives permission to ignore it on a day nothing was spent.
 */
const LOG_LINES: { title: string; body: string }[] = [
  { title: 'Anything to log from today?', body: 'Ten seconds now keeps this month’s numbers right.' },
  { title: 'Log today before you forget', body: 'Cash and small spends are the easiest to lose track of.' },
  { title: 'Did you spend anything today?', body: 'Add it now, while you still remember the amount.' },
  {
    title: 'Is today in your ledger?',
    body: 'A spend added tonight is one you won’t have to remember tomorrow.',
  },
  { title: 'Close out today', body: 'Add what you spent. If it was a no-spend day, ignore this.' },
  { title: 'Today’s spends, while they’re fresh', body: 'Your budgets are only as right as what’s logged.' },
  { title: 'Anything from today missing?', body: 'A quick add now saves guessing at the end of the month.' },
];

/** The evening nudge for a weekday (0 = Sunday). */
export function logCopy(weekday: number): NotificationText {
  const line = LOG_LINES[((weekday % 7) + 7) % 7];
  return { ...line, extra: line.title };
}

export function wrapCopy(): NotificationText {
  return {
    title: 'Your week, wrapped',
    body: 'See where your money went and what stood out last week.',
    extra: 'Your week, wrapped',
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One or more EMIs due the same day, as one entry. */
export function emiCopy(loans: { counterparty: string; emiMinor: number }[]): NotificationText {
  const total = formatMoney(loans.reduce((sum, l) => sum + l.emiMinor, 0));
  if (loans.length === 1) {
    const [loan] = loans;
    const line = `${loan.counterparty} EMI ${formatMoney(loan.emiMinor)} is due today`;
    return { title: line, body: 'Paid on time, it stays off your late list.', extra: line };
  }
  const line = `${loans.length} EMIs due today: ${total}`;
  return {
    title: line,
    body: loans.map((l) => `${l.counterparty} · ${formatMoney(l.emiMinor)}`).join('\n'),
    extra: line,
  };
}

/** EMIs still unpaid after their due day, as one entry. `dueLabel` words a due date ("3 Oct"). */
export function emiOverdueCopy(
  loans: { counterparty: string; emiMinor: number; dueDate: string; daysLate: number }[],
  dueLabel: (iso: string) => string
): NotificationText {
  const total = formatMoney(loans.reduce((sum, l) => sum + l.emiMinor, 0));
  if (loans.length === 1) {
    const [loan] = loans;
    const line = `${loan.counterparty} EMI is ${plural(loan.daysLate, 'day')} late`;
    return {
      title: line,
      body: `${formatMoney(loan.emiMinor)}, was due ${dueLabel(loan.dueDate)}. Marking it paid stops these reminders.`,
      extra: line,
    };
  }
  const line = `${loans.length} EMIs are late: ${total}`;
  return {
    title: line,
    body: loans
      .map((l) => `${l.counterparty} · ${formatMoney(l.emiMinor)}, due ${dueLabel(l.dueDate)}`)
      .join('\n'),
    extra: line,
  };
}

/** A recurring bill that goes out tomorrow. `amount` is left out when it isn't known. */
export function billCopy(label: string, amount: string | null): NotificationText {
  const line = `${label}${amount ? ` ${amount}` : ''} goes out tomorrow`;
  return { title: line, body: 'Make sure the account has enough for it.', extra: line };
}

/** A refund due today, or (`late`) still not in a few days after. */
export function refundCopy(label: string, amount: string | null, late: boolean): NotificationText {
  const title = late ? `${label} refund: still waiting?` : `${label} refund should arrive today`;
  const what = amount ? `${amount} expected. ` : '';
  return {
    title,
    body: late
      ? `${what}It was due a few days ago. Mark it received once it lands.`
      : `${what}Mark it received when it lands.`,
    extra: late ? `${label} refund is still pending` : `${label} refund is due today`,
  };
}

/** A budget passing 80% of its limit ('near'), or going over it. `daysLeft` (days after today, as Home counts them) is only said when it is this month's. */
export function budgetAlertCopy(
  level: 'near' | 'over',
  categoryName: string,
  spent: string,
  limit: string,
  left: string,
  over: string,
  daysLeft?: number
): NotificationText {
  if (level === 'over') {
    const title = `${categoryName} is ${over} over budget`;
    return { title, body: `${spent} spent of your ${limit} monthly budget.`, extra: title };
  }
  const title = `${categoryName}: ${left} left in your budget`;
  return {
    title,
    body: `${spent} of ${limit} used${daysLeft ? `, with ${plural(daysLeft, 'day')} to go` : ''}.`,
    extra: title,
  };
}

/** A category well past its total for last month. */
export function spikeCopy(categoryName: string, pctLabel: string): NotificationText {
  const title = `${categoryName} is up ${pctLabel} on last month`;
  return { title, body: 'Already above what you spent on it in all of last month.', extra: title };
}
