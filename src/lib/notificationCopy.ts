import { formatMoney } from './money';

/**
 * Wording of every Yume notification: one fixed, plain text each. When several things are due together the
 * first leads and the others join as extra lines, using `extra` (a one-line form of the same thing).
 */
export interface NotificationText {
  title: string;
  body: string;
  extra: string;
}

export function logCopy(): NotificationText {
  return {
    title: 'Log today',
    body: 'Anything spent today? Tap to add it.',
    extra: 'Anything to log today?',
  };
}

export function wrapCopy(): NotificationText {
  return {
    title: 'Your week, wrapped',
    body: 'Tap to play last week.',
    extra: 'Your week, wrapped',
  };
}

/** One or more EMIs due the same day, as one entry. */
export function emiCopy(loans: { counterparty: string; emiMinor: number }[]): NotificationText {
  const total = formatMoney(loans.reduce((sum, l) => sum + l.emiMinor, 0));
  const body = `${loans.map((l) => l.counterparty).join(', ')} · ${total}`;
  return {
    title: loans.length === 1 ? 'EMI due today' : `${loans.length} EMIs due today`,
    body,
    extra: body,
  };
}

/** A budget passing 80% of its limit ('near'), or going over it. */
export function budgetAlertCopy(
  level: 'near' | 'over',
  categoryName: string,
  spent: string,
  limit: string,
  left: string
): NotificationText {
  if (level === 'over') {
    const title = `${categoryName} is over budget`;
    return { title, body: `${spent} of ${limit} this month.`, extra: `${title} (${spent} of ${limit})` };
  }
  const title = `${categoryName} is at 80% of its budget`;
  return { title, body: `${left} of ${limit} left this month.`, extra: title };
}

/** A category well past its total for last month. */
export function spikeCopy(categoryName: string, pctLabel: string): NotificationText {
  return {
    title: `${categoryName} is up ${pctLabel}`,
    body: 'Compared with last month.',
    extra: `${categoryName} is up ${pctLabel} on last month`,
  };
}
