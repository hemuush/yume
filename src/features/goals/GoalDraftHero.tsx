import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { dayMonthYear } from '@/lib/dateLabels';
import { GoalHero } from './GoalHero';

/**
 * A goal as the card the Edit goal and Add money sheets open on, with the figures as they will be once saved.
 * `after` says so in the kicker ("After this") instead of "Savings goal". Amounts hidden: the saved figure is
 * masked, the bar is empty and the goal is never shown as reached.
 */
export function GoalDraftHero({
  name,
  savedMinor,
  targetMinor,
  targetDate,
  after = false,
}: {
  name: string;
  savedMinor: number;
  targetMinor: number;
  targetDate?: string | null;
  after?: boolean;
}) {
  const { hideAmounts } = usePrivacy();
  const { secondary } = useAccent();
  const { percent, done } = goalProgress(savedMinor, targetMinor);
  const label = after ? 'After this' : 'Savings goal';
  return (
    <GoalHero
      hue={done && !hideAmounts ? theme.colors.flatLime : secondary}
      icon={done && !hideAmounts ? 'flag-checkered' : 'piggy-bank-outline'}
      name={name}
      kicker={
        hideAmounts
          ? `${label} · of ${formatMoney(targetMinor)}`
          : done
            ? `${label} · Reached`
            : `${label} · ${Math.round(percent)}% of ${formatMoney(targetMinor)}`
      }
      saved={formatMaskableMoney(savedMinor, { masked: hideAmounts })}
      fraction={hideAmounts ? 0 : percent / 100}
      toGo={
        hideAmounts
          ? undefined
          : done
            ? { reached: true }
            : { figure: formatMoney(Math.max(0, targetMinor - savedMinor)) }
      }
      date={!hideAmounts && targetDate ? dayMonthYear(targetDate) : undefined}
    />
  );
}
