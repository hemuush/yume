import { BudgetProgress } from '@/db/budgets';
import { GoalRing } from '@/features/goals/GoalRing';
import { useToday } from '@/features/budgets/useToday';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { budgetPace, BUDGET_PACE_LABEL } from '@/lib/pace';
import { categorySentence } from '@/lib/categoryLabel';
import { HomeRow, HomeRowChipTone } from './HomeRow';

/**
 * One budget on Home, in the shared row: a ring of how much of the limit is gone, the category and what has
 * been spent of it, what is left (or over) on the right with the pace as a chip. The ring is amber when ahead
 * of pace and coral once over; the words say the same, so colour is never the only signal.
 */
export function HomeBudgetRow({
  progress,
  divider,
  onPress,
}: {
  progress: BudgetProgress;
  divider: boolean;
  onPress: () => void;
}) {
  // Pace only means something for the month still running.
  const today = useToday();
  const pace =
    progress.budget.periodMonth === today.slice(0, 7) ? budgetPace(progress.percentUsed / 100, today) : null;
  const over = progress.overBudget;
  const ahead = !over && pace?.state === 'ahead';
  const left = over
    ? `${formatMoney(Math.abs(progress.remainingMinor))} over`
    : `${formatMoney(progress.remainingMinor)} left`;
  const chip: { label: string; tone: HomeRowChipTone } | undefined = over
    ? { label: 'Over limit', tone: 'warning' }
    : pace
      ? { label: BUDGET_PACE_LABEL[pace.state], tone: ahead ? 'due' : 'complete' }
      : undefined;
  const spent = `${formatMoney(progress.spentMinor)} of ${formatMoney(progress.effectiveLimitMinor)}`;
  return (
    <HomeRow
      grow
      leading={
        <GoalRing
          percent={Math.min(100, progress.percentUsed)}
          label={`${Math.round(progress.percentUsed)}%`}
          color={over ? theme.colors.expense : ahead ? theme.colors.slice.due : theme.colors.slice.saved}
          size={40}
        />
      }
      title={progress.categoryName}
      subtitle={spent}
      value={left}
      valueTone={over ? 'over' : undefined}
      chip={chip}
      onPress={onPress}
      divider={divider}
      accessibilityLabel={[
        categorySentence(progress.categoryName, progress.parentName),
        spent,
        over
          ? `${formatMoney(Math.abs(progress.remainingMinor))} over budget`
          : `${formatMoney(progress.remainingMinor)} left`,
        ...(chip ? [chip.label] : []),
      ].join(', ')}
    />
  );
}
