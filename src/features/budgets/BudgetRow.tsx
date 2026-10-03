import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { BudgetProgress } from '@/db/budgets';
import { formatMoney } from '@/lib/money';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LimitMeter, LimitMeterTone } from '@/components/LimitMeter';
import { budgetPace, BUDGET_PACE_LABEL } from '@/lib/pace';
import { toLocalIsoDate } from '@/lib/date';
import { usePressScale } from '@/lib/usePressScale';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { styles } from './budgets.styles';
import { monthDayInfo } from './budgetsOverview';
import { withPressed } from '@/lib/pressed';
import { categorySentence, inParent } from '@/lib/categoryLabel';

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
}: {
  progress: BudgetProgress;
  divider: boolean;
  onPress: () => void;
  onMore?: () => void;
  showPerDay?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const barPct = Math.min(100, progress.percentUsed);
  // Pace only means something for the month still running.
  const today = toLocalIsoDate(new Date());
  const pace =
    progress.budget.periodMonth === today.slice(0, 7) ? budgetPace(progress.percentUsed / 100, today) : null;
  const daysLeft = monthDayInfo(today).daysLeft;
  const perDayMinor =
    showPerDay && pace && !progress.overBudget && progress.remainingMinor > 0 && daysLeft > 0
      ? Math.floor(progress.remainingMinor / daysLeft)
      : null;
  const tone: LimitMeterTone = progress.overBudget ? 'over' : pace?.state === 'ahead' ? 'near' : 'ok';

  return (
    <AnimatedPressable
      style={[styles.row, divider && styles.rowDivider, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onMore}
    >
      <View style={styles.rowTop}>
        <CategoryIcon name={progress.categoryIcon} color={progress.categoryColor} square={38} size={17} />
        <View style={styles.rowNameBlock}>
          <Text style={styles.rowName} numberOfLines={1}>
            {progress.categoryName}
          </Text>
          {!!progress.parentName && (
            <Text style={styles.rowParent} numberOfLines={1}>
              {inParent(progress.parentName)}
            </Text>
          )}
        </View>
        <Text style={styles.rowAmount}>
          <Text style={progress.overBudget ? styles.rowAmountOver : undefined}>
            {formatMoney(progress.spentMinor)}
          </Text>
          <Text style={styles.rowAmountOf}> / {formatMoney(progress.effectiveLimitMinor)}</Text>
        </Text>
        {onMore && (
          <Pressable
            onPress={onMore}
            hitSlop={10}
            style={withPressed(styles.moreBtn)}
            accessibilityRole="button"
            accessibilityLabel={`More for ${categorySentence(progress.categoryName, progress.parentName)} budget`}
          >
            <Feather name="more-horizontal" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>
      <LimitMeter
        pct={barPct}
        tone={tone}
        marker={pace ? pace.expectedFraction * 100 : undefined}
        animKey={`budget:${progress.budget.id}`}
      />
      <View style={styles.rowFoot}>
        <Text style={[styles.rowNote, progress.overBudget && styles.rowNoteOver]}>
          {progress.overBudget
            ? `${formatMoney(Math.abs(progress.remainingMinor))} over budget`
            : perDayMinor != null
              ? `${formatMoney(progress.remainingMinor)} left · ${formatMoney(perDayMinor)} a day`
              : `${formatMoney(progress.remainingMinor)} left this month`}
        </Text>
        {pace && !progress.overBudget && (
          <Text style={[styles.rowPace, pace.state === 'ahead' && styles.rowPaceAhead]}>
            {BUDGET_PACE_LABEL[pace.state]}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}
