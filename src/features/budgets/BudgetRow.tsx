import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { BudgetProgress } from '@/db/budgets';
import { formatMoney } from '@/lib/money';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LimitMeter, LimitMeterTone } from '@/components/LimitMeter';
import { budgetPace, BUDGET_PACE_LABEL } from '@/lib/pace';
import { usePressScale } from '@/lib/usePressScale';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { styles } from './budgets.styles';
import { monthDayInfo } from './budgetsOverview';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { categorySentence, inParent } from '@/lib/categoryLabel';
import { useCardGrow } from '@/lib/cardGrow';
import { useToday } from './useToday';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One category's monthly limit and how much is gone; tap behaviour is up to the screen. `onMore` adds a
 * visible ⋯ button (same menu as long-press). `showPerDay` adds the daily allowance (Budgets only).
 */
export function BudgetRow({
  progress,
  divider,
  onPress,
  onMore,
  showPerDay,
  grow,
}: {
  progress: BudgetProgress;
  divider: boolean;
  onPress: () => void;
  onMore?: () => void;
  showPerDay?: boolean;
  /** The page it opens expands out of this row (the caller marks that push with `growHref`). */
  grow?: boolean;
}) {
  const { accent } = useAccent();
  const { ref, growFrom } = useCardGrow();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const barPct = Math.min(100, progress.percentUsed);
  // Pace only means something for the month still running.
  const today = useToday();
  const pace =
    progress.budget.periodMonth === today.slice(0, 7) ? budgetPace(progress.percentUsed / 100, today) : null;
  const daysLeft = monthDayInfo(today).daysLeft;
  const perDayMinor =
    showPerDay && pace && !progress.overBudget && progress.remainingMinor > 0 && daysLeft > 0
      ? Math.floor(progress.remainingMinor / daysLeft)
      : null;
  const tone: LimitMeterTone = progress.overBudget ? 'over' : pace?.state === 'ahead' ? 'near' : 'ok';

  // The row read out as one line: what it is, what's spent of the limit, and where that leaves you.
  const rowLabel = [
    categorySentence(progress.categoryName, progress.parentName),
    `${formatMoney(progress.spentMinor)} of ${formatMoney(progress.effectiveLimitMinor)}`,
    progress.overBudget
      ? `${formatMoney(Math.abs(progress.remainingMinor))} over budget`
      : `${formatMoney(progress.remainingMinor)} left`,
  ].join(', ');

  const name = (
    <View style={styles.rowNameBlock}>
      <Text style={styles.rowName}>{progress.categoryName}</Text>
      {!!progress.parentName && <Text style={styles.rowParent}>{inParent(progress.parentName)}</Text>}
    </View>
  );
  const more = onMore && (
    <Pressable
      onPress={(event) => {
        event?.stopPropagation();
        onMore();
      }}
      hitSlop={10}
      style={withPressedTint(accent, styles.moreBtn)}
      accessibilityRole="button"
      accessibilityLabel={`More for ${categorySentence(progress.categoryName, progress.parentName)} budget`}
    >
      <Feather name="more-horizontal" size={16} color={theme.colors.textSecondary} />
    </Pressable>
  );
  // What matters sits beside the name; the caption carries the rest once: spent of limit, a day, pace.
  const head = (
    <Text
      style={[styles.rowHead, progress.overBudget && styles.rowHeadOver]}
      numberOfLines={1}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {progress.overBudget
        ? `${formatMoney(Math.abs(progress.remainingMinor))} over`
        : `${formatMoney(progress.remainingMinor)} left`}
    </Text>
  );
  const caption = (
    <Text
      style={styles.rowCaption}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {`${formatMoney(progress.spentMinor)} of ${formatMoney(progress.effectiveLimitMinor)}`}
      {perDayMinor != null ? ` · ${formatMoney(perDayMinor)} a day` : ''}
      {pace && !progress.overBudget && (
        <Text style={pace.state === 'ahead' ? styles.rowPaceAhead : styles.rowPace}>
          {` · ${BUDGET_PACE_LABEL[pace.state]}`}
        </Text>
      )}
    </Text>
  );

  return (
    <AnimatedPressable
      ref={ref}
      collapsable={false}
      style={[styles.row, divider && styles.rowDivider, animatedStyle]}
      onPress={grow ? () => growFrom(onPress) : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={rowLabel}
      accessibilityHint={onMore ? 'Press and hold for more options' : undefined}
    >
      <>
        <View style={styles.rowTop}>
          <CategoryIcon name={progress.categoryIcon} color={progress.categoryColor} square={38} size={17} />
          {name}
          {head}
          {more}
        </View>
        <LimitMeter
          pct={barPct}
          tone={tone}
          marker={pace ? pace.expectedFraction * 100 : undefined}
          animKey={`budget:${progress.budget.id}`}
        />
        {caption}
      </>
    </AnimatedPressable>
  );
}
