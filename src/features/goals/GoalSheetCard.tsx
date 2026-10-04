import { SheetCard } from '@/components/SheetCard';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { dayMonthYear } from '@/lib/dateLabels';

/**
 * A goal as the card its sheets open on (saved vs target, with a bar), shared by New goal, Edit goal and
 * Add money, each passing the figures as they'll be once saved.
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
  const { hideAmounts } = usePrivacy();
  const { percent, done } = goalProgress(savedMinor, targetMinor);
  return (
    <SheetCard
      hue={done && !hideAmounts ? theme.colors.flatLime : theme.colors.secondary}
      icon={done && !hideAmounts ? 'flag-checkered' : 'piggy-bank-outline'}
      kicker={kicker ?? (hideAmounts ? 'Saved' : done ? 'Reached' : `${Math.round(percent)}%`)}
      amount={formatMaskableMoney(savedMinor, { masked: hideAmounts })}
      title={name}
      meta={`of ${formatMoney(targetMinor)}${targetDate ? ` · by ${dayMonthYear(targetDate)}` : ''}`}
      progress={hideAmounts ? 0 : percent / 100}
    />
  );
}
