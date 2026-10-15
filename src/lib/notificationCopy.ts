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

export function morningCopy(): NotificationText {
  return {
    title: 'Your day, at a glance',
    body: 'Check upcoming payments, budgets and goals for today.',
    extra: 'Review your plans for today',
  };
}

export function logCopy(): NotificationText {
  return {
    title: 'Before you call it a day',
    body: 'Add today’s spending while it’s fresh in mind.',
    extra: 'Add anything you spent today',
  };
}

export function wrapCopy(): NotificationText {
  return {
    title: 'Your week, wrapped',
    body: 'See where your money went and what stood out last week.',
    extra: 'Your week, wrapped',
  };
}

/** One or more EMIs due the same day, as one entry. */
export function emiCopy(loans: { counterparty: string; emiMinor: number }[]): NotificationText {
  const total = formatMoney(loans.reduce((sum, l) => sum + l.emiMinor, 0));
  const body = `${loans.map((l) => l.counterparty).join(', ')} · ${total}`;
  return {
    title: loans.length === 1 ? 'EMI due today' : `${loans.length} EMIs due today`,
    body: `${body}\nReview your ${loans.length === 1 ? 'payment' : 'payments'} in Loans.`,
    extra: body,
  };
}

/** EMIs still unpaid after their due day, as one entry. `dueLabel` words a due date ("3 Oct"). */
export function emiOverdueCopy(
  loans: { counterparty: string; emiMinor: number; dueDate: string }[],
  dueLabel: (iso: string) => string
): NotificationText {
  const total = formatMoney(loans.reduce((sum, l) => sum + l.emiMinor, 0));
  const body =
    loans.length === 1
      ? `${loans[0].counterparty} · ${total} · was due ${dueLabel(loans[0].dueDate)}`
      : `${loans.map((l) => l.counterparty).join(', ')} · ${total}`;
  return {
    title: loans.length === 1 ? 'EMI overdue' : `${loans.length} EMIs overdue`,
    body: `${body}\nReview ${loans.length === 1 ? 'this payment' : 'these payments'} in Loans.`,
    extra:
      loans.length === 1 ? `${loans[0].counterparty} EMI is overdue` : `${loans.length} EMIs are overdue`,
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
    return {
      title,
      body: `${spent} spent against your ${limit} monthly budget. Tap to review it.`,
      extra: `${title} (${spent} of ${limit})`,
    };
  }
  const title = `${categoryName} budget is nearing its limit`;
  return {
    title,
    body: `${left} left from your ${limit} monthly budget. Tap to review.`,
    extra: `${categoryName}: ${left} left in the budget`,
  };
}

/** A category well past its total for last month. */
export function spikeCopy(categoryName: string, pctLabel: string): NotificationText {
  return {
    title: `${categoryName} is up ${pctLabel}`,
    body: 'Higher than last month’s total. Tap to explore the breakdown.',
    extra: `${categoryName} is up ${pctLabel} on last month`,
  };
}
