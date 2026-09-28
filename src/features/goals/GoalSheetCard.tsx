import { SheetCard } from '@/components/SheetCard';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { dayMonthYear } from '@/lib/dateLabels';

/**
 * A goal as the card its sheets open on (the calm-sheets sign-off,
 * Direction C) — saved against the target, with a bar — shared by New goal,
 * Edit goal and Add money, each passing the figures as they'll be once saved.
 */
export function GoalSheetCard({
  name,
  savedMinor,
  targetMinor,
  targetDate,
  kicker,
}: {
  name: string;
  savedMinor: number;
  targetMinor: number;
  targetDate?: string | null;
  /** Replaces the "40%" in the corner — "After this" on Add money. */
  kicker?: string;
}) {
  const { percent, done } = goalProgress(savedMinor, targetMinor);
  return (
    <SheetCard
      hue={done ? theme.colors.flatLime : theme.colors.secondary}
      icon={done ? 'flag-checkered' : 'piggy-bank-outline'}
      kicker={kicker ?? (done ? 'Reached' : `${percent}%`)}
      amount={formatMoney(savedMinor)}
      title={name}
      meta={`of ${formatMoney(targetMinor)}${targetDate ? ` · by ${dayMonthYear(targetDate)}` : ''}`}
      progress={percent / 100}
    />
  );
}
